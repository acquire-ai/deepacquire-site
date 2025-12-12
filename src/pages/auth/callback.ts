import type { APIRoute } from 'astro';

import { deleteCookie, parseCookies, serializeCookie } from '~/utils/auth/cookies';
import { exchangeCodeForTokens, getLogtoConfig, LOGTO_COOKIES } from '~/utils/auth/logto';
import { base64UrlDecodeToString } from '~/utils/auth/encoding';

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
  const secure = requestUrl.protocol === 'https:';

  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');

  if (!code || !state) {
    return new Response('Missing code/state in callback URL.', { status: 400 });
  }

  const cookies = parseCookies(context.request.headers.get('cookie'));

  // Preferred: single transaction cookie
  let expectedState: string | undefined;
  let codeVerifier: string | undefined;
  let returnTo: string = '/account';

  const txCookie = cookies[LOGTO_COOKIES.tx];
  if (txCookie) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = JSON.parse(base64UrlDecodeToString(txCookie)) as any;
      if (tx && typeof tx === 'object') {
        if (typeof tx.state === 'string') expectedState = tx.state;
        if (typeof tx.codeVerifier === 'string') codeVerifier = tx.codeVerifier;
        if (typeof tx.returnTo === 'string' && isSafeReturnToPath(tx.returnTo)) returnTo = tx.returnTo;
      }
    } catch {
      // ignore - will be treated as missing session
    }
  }

  if (!expectedState || !codeVerifier) {
    return new Response('Missing sign-in session. Please try signing in again.', { status: 400 });
  }

  if (expectedState !== state) {
    return new Response('Invalid state. Please try signing in again.', { status: 400 });
  }

  const config = getLogtoConfig(context.locals);
  const redirectUri = `${origin}/auth/callback`;

  const tokenResponse = await exchangeCodeForTokens({
    issuer: config.issuer,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri,
    code,
    codeVerifier,
  });

  const headers = new Headers();
  headers.set('Location', returnTo);
  headers.set('Cache-Control', 'no-store');

  // Store the ID token as the website session (HttpOnly cookie).
  headers.append(
    'Set-Cookie',
    serializeCookie(LOGTO_COOKIES.idToken, tokenResponse.id_token, {
      path: '/',
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      maxAge: tokenResponse.expires_in,
    })
  );

  // Cleanup temporary cookie (best-effort; ok if only the first Set-Cookie is honored)
  headers.append('Set-Cookie', deleteCookie(LOGTO_COOKIES.tx, { path: '/', secure, sameSite: 'Lax' }));

  return new Response(null, { status: 302, headers });
};
