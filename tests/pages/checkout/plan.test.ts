import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '~/pages/checkout/[plan]';
import { LOGTO_COOKIES } from '~/utils/auth/logto';

type FetchMock = ReturnType<typeof vi.fn>;

const GATEWAY = 'https://gateway.example.test';
const SESSION_JWT = 'fake.session.jwt';

const buildContext = (
  plan: string,
  options: {
    cookieValue?: string;
    envOverride?: Partial<{ GATEWAY_API_URL: string }>;
  } = {}
) => {
  const env: Record<string, string | undefined> = {
    GATEWAY_API_URL: GATEWAY,
    ...options.envOverride,
  };

  const headers = new Headers();
  if (options.cookieValue !== undefined) {
    headers.set('cookie', `${LOGTO_COOKIES.idToken}=${options.cookieValue}`);
  }

  return {
    params: { plan },
    request: new Request(`https://site.test/checkout/${plan}`, { headers }),
    locals: { runtime: { env } },
    redirect: (location: string) =>
      new Response(null, { status: 302, headers: { Location: location } }),
  };
};

const callGet = async (ctx: ReturnType<typeof buildContext>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return GET(ctx as any);
};

const buildPlansResponse = () =>
  new Response(
    JSON.stringify({
      version: 2,
      plans: [
        {
          id: 'free',
          displayName: 'Free',
          tier: 0,
          sharedCredits: 200,
          priceUsd: 0,
          stripePriceId: null,
        },
        {
          id: 'plus',
          displayName: 'Plus',
          tier: 1,
          sharedCredits: 1800,
          priceUsd: 3,
          stripePriceId: 'price_plus',
        },
        {
          id: 'pro',
          displayName: 'Pro',
          tier: 2,
          sharedCredits: 3000,
          priceUsd: 4.98,
          stripePriceId: 'price_pro',
        },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

let fetchMock: FetchMock;
let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  fetchMock = vi.fn();
  originalFetch = globalThis.fetch;
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('GET /checkout/[plan]', () => {
  it('redirects to /account?subscription_change=has_active when gateway returns 409 has_active_subscription', async () => {
    // First call resolves plans, second call is the gateway POST that 409s.
    fetchMock.mockResolvedValueOnce(buildPlansResponse()).mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'has_active_subscription', error: 'already' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const res = await callGet(buildContext('pro', { cookieValue: SESSION_JWT }));

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/account?subscription_change=has_active');

    // The second fetch must have hit the gateway with the session bearer.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toBe(`${GATEWAY}/api/checkout/session`);
    expect((init as RequestInit).method).toBe('POST');
    expect(((init as RequestInit).headers as Record<string, string>).Authorization).toBe(`Bearer ${SESSION_JWT}`);
  });

  it('redirects to the Stripe Checkout URL on a successful gateway response', async () => {
    fetchMock.mockResolvedValueOnce(buildPlansResponse()).mockResolvedValueOnce(
      new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/pay/cs_test' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const res = await callGet(buildContext('plus', { cookieValue: SESSION_JWT }));

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://checkout.stripe.com/c/pay/cs_test');
  });

  it('falls through to generic 502 when 409 body is not a has_active_subscription code', async () => {
    fetchMock.mockResolvedValueOnce(buildPlansResponse()).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'some other conflict' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const res = await callGet(buildContext('pro', { cookieValue: SESSION_JWT }));

    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).toMatch(/checkout session/i);
  });
});
