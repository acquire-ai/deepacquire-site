import type { APIRoute } from 'astro';

import { serializeCookie } from '~/utils/auth/cookies';
import { generateCodeChallenge, generateCodeVerifier, generateState } from '~/utils/auth/pkce';
import { buildSignInUrl, getLogtoConfig, LOGTO_COOKIES } from '~/utils/auth/logto';
import { base64UrlEncodeString } from '~/utils/auth/encoding';

export const prerender = false;

const isSafeReturnToPath = (value: string): boolean => {
  if (!value.startsWith('/')) return false;
  if (value.startsWith('//')) return false;
  if (value.includes('://')) return false;
  return true;
};

export const GET: APIRoute = async (context) => {
  const requestUrl = new URL(context.request.url);
  const origin = requestUrl.origin;

  const returnToRaw = requestUrl.searchParams.get('returnTo') ?? '/account';
  const returnTo = isSafeReturnToPath(returnToRaw) ? returnToRaw : '/account';

  const secure = requestUrl.protocol === 'https:';

  const config = getLogtoConfig(context.locals);
  const redirectUri = `${origin}/auth/callback`;

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();

  const signInUrl = await buildSignInUrl({
    issuer: config.issuer,
    clientId: config.clientId,
    scopes: config.scopes,
    redirectUri,
    state,
    codeChallenge,
  });

  const headers = new Headers();
  headers.set('Location', signInUrl);
  headers.set('Cache-Control', 'no-store');

  // Store the PKCE+state+returnTo in ONE cookie to avoid multi `Set-Cookie` edge/runtime quirks.
  const tx = base64UrlEncodeString(JSON.stringify({ v: 1, state, codeVerifier, returnTo }));
  headers.append(
    'Set-Cookie',
    serializeCookie(LOGTO_COOKIES.tx, tx, {
      path: '/',
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      maxAge: 60 * 10,
    })
  );

  return new Response(null, { status: 302, headers });
};
