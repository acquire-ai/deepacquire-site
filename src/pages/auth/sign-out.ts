import type { APIRoute } from 'astro';

import { deleteCookie, parseCookies } from '~/utils/auth/cookies';
import { buildSignOutUrl, getLogtoConfig, LOGTO_COOKIES } from '~/utils/auth/logto';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const requestUrl = new URL(context.request.url);
  const origin = requestUrl.origin;
  const secure = requestUrl.protocol === 'https:';

  const cookies = parseCookies(context.request.headers.get('cookie'));
  const idTokenHint = cookies[LOGTO_COOKIES.idToken];

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


