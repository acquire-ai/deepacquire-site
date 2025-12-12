import type { APIRoute } from 'astro';

import { deleteCookie, parseCookies, serializeCookie } from '~/utils/auth/cookies';
import { exchangeCodeForTokens, getLogtoConfig, LOGTO_COOKIES } from '~/utils/auth/logto';

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
  const expectedState = cookies[LOGTO_COOKIES.oauthState];
  const codeVerifier = cookies[LOGTO_COOKIES.pkceVerifier];
  const returnToRaw = cookies[LOGTO_COOKIES.returnTo] ?? '/account';
  const returnTo = isSafeReturnToPath(returnToRaw) ? returnToRaw : '/account';

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

  // Cleanup temporary cookies.
  for (const name of [LOGTO_COOKIES.pkceVerifier, LOGTO_COOKIES.oauthState, LOGTO_COOKIES.returnTo]) {
    headers.append('Set-Cookie', deleteCookie(name, { path: '/', secure, sameSite: 'Lax' }));
  }

  return new Response(null, { status: 302, headers });
};


