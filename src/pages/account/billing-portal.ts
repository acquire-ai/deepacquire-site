import type { APIRoute } from 'astro';

import { parseCookies } from '~/utils/auth/cookies';
import { getEnvValue, LOGTO_COOKIES } from '~/utils/auth/logto';

export const prerender = false;

const FETCH_TIMEOUT_MS = 5000;

export const GET: APIRoute = async (context) => {
  const cookies = parseCookies(context.request.headers.get('cookie'));
  const sessionToken = cookies[LOGTO_COOKIES.idToken];

  if (!sessionToken) {
    return context.redirect(`/auth/sign-in?returnTo=${encodeURIComponent('/account')}`);
  }

  const gatewayUrl = getEnvValue('GATEWAY_API_URL', context.locals);
  if (!gatewayUrl) {
    return new Response('Server misconfiguration: GATEWAY_API_URL missing', { status: 500 });
  }

  const origin = new URL(context.request.url).origin;

  let res: Response;
  try {
    res = await fetch(`${gatewayUrl.replace(/\/+$/g, '')}/api/billing/portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ returnUrl: `${origin}/account` }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    console.error('Billing portal fetch error:', err);
    return new Response('Unable to reach billing service. Please try again later.', { status: 502 });
  }

  // No subscription on file (e.g. user manually hit this URL without paying).
  // Send them to /pricing instead of showing a bare error page.
  if (res.status === 404) {
    return context.redirect('/pricing');
  }

  // Session token rejected by gateway — treat as expired session and re-auth.
  if (res.status === 401) {
    return context.redirect(`/auth/sign-in?returnTo=${encodeURIComponent('/account')}`);
  }

  if (!res.ok) {
    console.error(`Billing portal creation failed (${res.status})`);
    return new Response('Failed to open billing portal. Please try again.', { status: 502 });
  }

  const data = (await res.json().catch(() => ({}))) as { url?: string };
  if (!data.url) {
    return new Response('Invalid response from billing service.', { status: 502 });
  }

  // Stripe portal URLs are one-shot — never let intermediaries cache the redirect.
  const headers = new Headers();
  headers.set('Location', data.url);
  headers.set('Cache-Control', 'no-store');
  return new Response(null, { status: 302, headers });
};
