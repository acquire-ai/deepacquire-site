import type { APIRoute } from 'astro';
import { decodeJwt } from 'jose';

import { deleteCookie, parseCookies } from '~/utils/auth/cookies';
import { buildSignOutUrl, getLogtoConfig, LOGTO_COOKIES, SITE_SESSION_ISSUER } from '~/utils/auth/logto';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const requestUrl = new URL(context.request.url);
  const origin = requestUrl.origin;
  const secure = requestUrl.protocol === 'https:';

  const cookies = parseCookies(context.request.headers.get('cookie'));
  const sessionToken = cookies[LOGTO_COOKIES.idToken];

  // Only Logto-signed id_tokens may be passed as id_token_hint to the Logto
  // end-session endpoint. Gateway-signed HS256 site session JWTs (from the
  // /auth/sso bridge) are not recognized by Logto and would cause it to fall
  // back to a manual confirmation page.
  let idTokenHint: string | undefined;
  if (sessionToken) {
    try {
      const iss = decodeJwt(sessionToken).iss;
      if (iss && iss !== SITE_SESSION_ISSUER) idTokenHint = sessionToken;
    } catch {
      // Malformed token: don't pass it to Logto.
    }
  }

  const config = getLogtoConfig(context.locals);
  const postLogoutRedirectUri = `${origin}/`;

  const signOutUrl = await buildSignOutUrl({
    issuer: config.issuer,
    clientId: config.clientId,
    postLogoutRedirectUri,
    idTokenHint,
  });

  const headers = new Headers();
  headers.set('Location', signOutUrl);
  headers.set('Cache-Control', 'no-store');
  headers.append('Set-Cookie', deleteCookie(LOGTO_COOKIES.idToken, { path: '/', secure, sameSite: 'Lax' }));

  return new Response(null, { status: 302, headers });
};
