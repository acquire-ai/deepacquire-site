import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

import { base64EncodeString } from './encoding';

export const LOGTO_COOKIES = {
  // A single transaction cookie (preferred on edge runtimes to avoid multi Set-Cookie issues)
  tx: 'da_logto_tx',
  idToken: 'da_id_token',
} as const;

type RuntimeEnv = Record<string, string | undefined>;

export type LogtoConfig = {
  issuer: string;
  jwksUri: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
};

type OidcConfig = {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  endSessionEndpoint?: string;
};

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  id_token: string;
  refresh_token?: string;
  scope?: string;
};

const oidcConfigCache = new Map<string, Promise<OidcConfig>>();
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

const normalizeUrl = (url: string): string => url.replace(/\/+$/g, '');

const getRuntimeEnv = (locals: App.Locals | undefined): RuntimeEnv | undefined => {
  // Cloudflare adapter: `Astro.locals.runtime.env` / `context.locals.runtime.env`
  return locals?.runtime?.env as RuntimeEnv | undefined;
};

const getEnvValue = (key: string, locals?: App.Locals): string | undefined => {
  const runtime = getRuntimeEnv(locals);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vite = (import.meta as any).env as Record<string, string | undefined> | undefined;
  return runtime?.[key] ?? vite?.[key];
};

export const getLogtoConfig = (locals?: App.Locals): LogtoConfig => {
  const issuer = getEnvValue('LOGTO_ISSUER', locals);
  const jwksUri = getEnvValue('LOGTO_JWKS_URI', locals);
  const clientId = getEnvValue('LOGTO_APP_ID', locals);
  const clientSecret = getEnvValue('LOGTO_APP_SECRET', locals);
  const scopes = getEnvValue('LOGTO_SCOPES', locals);

  const missing: string[] = [];
  if (!issuer) missing.push('LOGTO_ISSUER');
  if (!jwksUri) missing.push('LOGTO_JWKS_URI');
  if (!clientId) missing.push('LOGTO_APP_ID');
  if (!clientSecret) missing.push('LOGTO_APP_SECRET');
  if (!scopes) missing.push('LOGTO_SCOPES');

  if (missing.length) {
    throw new Error(`Missing Logto environment variables: ${missing.join(', ')}`);
  }

  return {
    issuer: normalizeUrl(issuer!),
    jwksUri: normalizeUrl(jwksUri!),
    clientId: clientId!,
    clientSecret: clientSecret!,
    scopes: scopes!,
  };
};

export const getOidcConfig = async (issuer: string): Promise<OidcConfig> => {
  const normalizedIssuer = normalizeUrl(issuer);
  const cached = oidcConfigCache.get(normalizedIssuer);
  if (cached) return cached;

  const promise = (async () => {
    const discoveryUrl = `${normalizedIssuer}/.well-known/openid-configuration`;
    const res = await fetch(discoveryUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch OIDC discovery document (${res.status}): ${discoveryUrl}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = (await res.json()) as any;

    return {
      issuer: json.issuer as string,
      authorizationEndpoint: json.authorization_endpoint as string,
      tokenEndpoint: json.token_endpoint as string,
      endSessionEndpoint: json.end_session_endpoint as string | undefined,
    } satisfies OidcConfig;
  })();

  oidcConfigCache.set(normalizedIssuer, promise);
  return promise;
};

export const buildSignInUrl = async (params: {
  issuer: string;
  clientId: string;
  scopes: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): Promise<string> => {
  const { authorizationEndpoint } = await getOidcConfig(params.issuer);

  const url = new URL(authorizationEndpoint);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', params.scopes);
  url.searchParams.set('state', params.state);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  return url.toString();
};

export const exchangeCodeForTokens = async (params: {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): Promise<TokenResponse> => {
  if (!params.clientSecret) {
    throw new Error('Missing LOGTO_APP_SECRET. Please configure it as a Cloudflare Pages secret / env var.');
  }

  const { tokenEndpoint } = await getOidcConfig(params.issuer);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: params.clientId,
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });

  const authorization = `Basic ${base64EncodeString(`${params.clientId}:${params.clientSecret}`)}`;

  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization,
    },
    body,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    throw new Error(
      `Token exchange failed (${res.status}): ${json?.error ?? ''} ${json?.error_description ?? ''}`.trim()
    );
  }

  return json as TokenResponse;
};

export const buildSignOutUrl = async (params: {
  issuer: string;
  clientId: string;
  postLogoutRedirectUri: string;
  idTokenHint?: string;
}): Promise<string> => {
  const { endSessionEndpoint } = await getOidcConfig(params.issuer);
  if (!endSessionEndpoint) return params.postLogoutRedirectUri;

  const url = new URL(endSessionEndpoint);
  url.searchParams.set('post_logout_redirect_uri', params.postLogoutRedirectUri);
  url.searchParams.set('client_id', params.clientId);
  if (params.idTokenHint) url.searchParams.set('id_token_hint', params.idTokenHint);

  return url.toString();
};

export const verifyIdToken = async (params: {
  idToken: string;
  issuer: string;
  audience: string;
  jwksUri: string;
}): Promise<JWTPayload> => {
  const jwks =
    jwksCache.get(params.jwksUri) ??
    (() => {
      const set = createRemoteJWKSet(new URL(params.jwksUri));
      jwksCache.set(params.jwksUri, set);
      return set;
    })();

  const { payload } = await jwtVerify(params.idToken, jwks, {
    issuer: params.issuer,
    audience: params.audience,
  });

  return payload;
};
