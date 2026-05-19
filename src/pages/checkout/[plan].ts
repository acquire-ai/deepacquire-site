import type { APIRoute } from 'astro';

import { parseCookies } from '~/utils/auth/cookies';
import { LOGTO_COOKIES } from '~/utils/auth/logto';
import { fetchPlans, getPriceIdMap } from '~/utils/plans';

export const prerender = false;

const VALID_PAID_PLANS = new Set(['plus', 'pro', 'max']);

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
    return new Response('Unknown plan. Valid options: plus, pro, max.', { status: 404 });
  }

  const plans = await fetchPlans(context.locals);
  const priceIdMap = getPriceIdMap(plans);
  const priceId = priceIdMap[plan];

  if (!priceId) {
    const planExists = plans.some((p) => p.id === plan);
    if (planExists) {
      return new Response(`${plan} plan is not available for checkout yet. Stay tuned!`, { status: 503 });
    }
    return new Response('Unknown plan. Valid options: plus, pro, max.', { status: 404 });
  }

  const cookies = parseCookies(context.request.headers.get('cookie'));
  // Cookie name kept as LOGTO_COOKIES.idToken (`da_id_token`) for backward compatibility,
  // but the value may now be either a Logto id_token or a gateway-signed HS256 site
  // session JWT (set by /auth/sso). Gateway accepts both.
  const sessionToken = cookies[LOGTO_COOKIES.idToken];

  if (!sessionToken) {
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
        Authorization: `Bearer ${sessionToken}`,
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

    // Already-subscribed users must change plans through the Stripe customer
    // portal so we never end up with two stacked subscriptions. Send them to
    // /account, where a confirm dialog (triggered by ?subscription_change=
    // has_active) offers to open the portal in one click.
    if (res.status === 409) {
      try {
        const parsed = JSON.parse(text) as { code?: string };
        if (parsed.code === 'has_active_subscription') {
          return context.redirect('/account?subscription_change=has_active');
        }
      } catch {
        // fall through to generic handling below
      }
    }

    // Surface validation-style errors (400) back to the user so they see
    // actionable copy. Anything else is treated as an upstream/payment-service failure.
    if (res.status === 400) {
      let message = 'Invalid request. Please refresh and try again.';
      try {
        const parsed = JSON.parse(text) as { error?: unknown };
        if (typeof parsed.error === 'string' && parsed.error.trim()) {
          message = parsed.error;
        }
      } catch {
        // body wasn't JSON — keep the generic message
      }
      return new Response(message, { status: 400 });
    }

    return new Response('Failed to create checkout session. Please try again.', { status: 502 });
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url) {
    return new Response('Invalid response from payment service.', { status: 502 });
  }

  return context.redirect(data.url);
};
