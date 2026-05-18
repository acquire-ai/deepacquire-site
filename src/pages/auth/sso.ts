import type { APIRoute } from 'astro';

import { serializeCookie } from '~/utils/auth/cookies';
import { getEnvValue, LOGTO_COOKIES } from '~/utils/auth/logto';

export const prerender = false;

const isSafeReturnToPath = (value: string): boolean => {
  if (!value.startsWith('/')) return false;
  if (value.startsWith('//')) return false;
  if (value.includes('://')) return false;
  return true;
};

type RedeemResponse = {
  sessionJwt: string;
  user?: { sub?: string; email?: string; name?: string; picture?: string };
  expiresAt?: number;
};

const SESSION_COOKIE_FALLBACK_TTL_SECONDS = 60 * 60;

export const GET: APIRoute = async (context) => {
  const requestUrl = new URL(context.request.url);
  const secure = requestUrl.protocol === 'https:';

  const tokenParam = requestUrl.searchParams.get('token');
  const token = typeof tokenParam === 'string' ? tokenParam.trim() : '';
  if (!token) {
    return new Response('Bad Request: missing token', { status: 400 });
  }

  const returnToRaw = requestUrl.searchParams.get('returnTo') ?? '/account';
  const returnTo = isSafeReturnToPath(returnToRaw) ? returnToRaw : '/account';

  const siteSecret = getEnvValue('SITE_REDEEM_SECRET', context.locals);
  const gatewayUrl = getEnvValue('GATEWAY_API_URL', context.locals);

  if (!siteSecret) {
    return new Response('Server misconfiguration: SITE_REDEEM_SECRET missing', { status: 500 });
  }
  if (!gatewayUrl) {
    return new Response('Server misconfiguration: GATEWAY_API_URL missing', { status: 500 });
  }

  let res: Response;
  try {
    res = await fetch(`${gatewayUrl.replace(/\/+$/g, '')}/api/auth/redeem-handoff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Site-Secret': siteSecret,
      },
      body: JSON.stringify({ token }),
    });
  } catch (err) {
    // Network / DNS / TLS error reaching the gateway. Do NOT log token.
    console.error('SSO redeem fetch error:', err);
    return new Response('Unable to verify sign-in. Try again.', { status: 502 });
  }

  if (res.status === 410) {
    return new Response('Sign-in link expired. Please try again from the extension.', { status: 400 });
  }

  if (res.status === 401) {
    // Gateway rejected our X-Site-Secret. This is OUR misconfiguration, not the user's fault.
    console.error('SSO redeem rejected by gateway with 401: site secret mismatch');
    return new Response('Server misconfiguration: redeem rejected by gateway', { status: 500 });
  }

  if (!res.ok) {
    // Surface a generic error; avoid echoing gateway response body since it could
    // include diagnostic data we don't want exposed.
    console.error(`SSO redeem failed with non-OK status: ${res.status}`);
    return new Response('Unable to verify sign-in. Try again.', { status: 502 });
  }

  let body: RedeemResponse;
  try {
    body = (await res.json()) as RedeemResponse;
  } catch {
    console.error('SSO redeem returned invalid JSON');
    return new Response('Unable to verify sign-in. Try again.', { status: 502 });
  }

  if (!body.sessionJwt || typeof body.sessionJwt !== 'string') {
    console.error('SSO redeem response missing sessionJwt');
    return new Response('Unable to verify sign-in. Try again.', { status: 502 });
  }

  // Compute Max-Age from server-provided expiresAt (epoch seconds) when present;
  // otherwise fall back to the documented 1-hour TTL of HS256 site session JWTs.
  const nowSeconds = Math.floor(Date.now() / 1000);
  let maxAge = SESSION_COOKIE_FALLBACK_TTL_SECONDS;
  if (typeof body.expiresAt === 'number' && Number.isFinite(body.expiresAt)) {
    const computed = Math.floor(body.expiresAt - nowSeconds);
    if (computed > 0) maxAge = computed;
  }

  const headers = new Headers();
  headers.set('Location', returnTo);
  headers.set('Cache-Control', 'no-store');
  headers.append(
    'Set-Cookie',
    serializeCookie(LOGTO_COOKIES.idToken, body.sessionJwt, {
      path: '/',
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      maxAge,
    })
  );

  return new Response(null, { status: 302, headers });
};
