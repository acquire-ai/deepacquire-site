import type { APIRoute } from 'astro';

import { parseCookies } from '~/utils/auth/cookies';
import { LOGTO_COOKIES } from '~/utils/auth/logto';
import { fetchPlans, getPriceIdMap } from '~/utils/plans';

export const prerender = false;

const VALID_PAID_PLANS = new Set(['pro', 'max', 'ultra']);

const getEnv = (key: string, locals: App.Locals): string | undefined => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runtime = (locals as any)?.runtime?.env as Record<string, string> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vite = (import.meta as any).env as Record<string, string | undefined> | undefined;
  return runtime?.[key] ?? vite?.[key];
};

export const GET: APIRoute = async (context) => {
  const plan = context.params.plan;

  if (!plan || !VALID_PAID_PLANS.has(plan)) {
    return new Response('Unknown plan. Valid options: pro, max, ultra.', { status: 404 });
  }

  const plans = await fetchPlans(context.locals);
  const priceIdMap = getPriceIdMap(plans);
  const priceId = priceIdMap[plan];

  if (!priceId) {
    // Plan exists in catalog but no Stripe price configured yet (e.g. ultra)
    const planExists = plans.some((p) => p.id === plan);
    if (planExists) {
      return new Response(`${plan === 'ultra' ? 'Ultra' : plan} plan is coming soon. Stay tuned!`, { status: 503 });
    }
    return new Response('Unknown plan. Valid options: pro, max, ultra.', { status: 404 });
  }

  const cookies = parseCookies(context.request.headers.get('cookie'));
  const idToken = cookies[LOGTO_COOKIES.idToken];

  if (!idToken) {
    return context.redirect(`/auth/sign-in?returnTo=${encodeURIComponent('/pricing')}`);
  }

  const gatewayUrl = getEnv('GATEWAY_API_URL', context.locals);
  if (!gatewayUrl) {
    return new Response('Server misconfiguration: GATEWAY_API_URL missing', { status: 500 });
  }

  const requestUrl = new URL(context.request.url);
  const origin = requestUrl.origin;

  let res: Response;
  try {
    res = await fetch(`${gatewayUrl}/api/checkout/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        priceId,
        successUrl: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/checkout/cancel`,
      }),
    });
  } catch (err) {
    console.error('Checkout fetch error:', err);
    return new Response('Unable to reach payment service. Please try again later.', { status: 502 });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`Checkout session creation failed (${res.status}): ${text}`);
    return new Response('Failed to create checkout session. Please try again.', { status: 502 });
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url) {
    return new Response('Invalid response from payment service.', { status: 502 });
  }

  return context.redirect(data.url);
};
