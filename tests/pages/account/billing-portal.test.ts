import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '~/pages/account/billing-portal';
import { LOGTO_COOKIES } from '~/utils/auth/logto';

type FetchMock = ReturnType<typeof vi.fn>;

const GATEWAY = 'https://gateway.example.test';
const SESSION_JWT = 'fake.session.jwt';

const buildContext = (
  url: string,
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
    request: new Request(url, { headers }),
    locals: { runtime: { env } },
    // Astro's `context.redirect` returns a 302 Response. The route uses it for
    // sign-in and "no subscription" branches, so we stub it here.
    redirect: (location: string) => new Response(null, { status: 302, headers: { Location: location } }),
  };
};

const callGet = async (ctx: ReturnType<typeof buildContext>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return GET(ctx as any);
};

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

describe('GET /account/billing-portal', () => {
  it('redirects to sign-in when session cookie is missing', async () => {
    const res = await callGet(buildContext('https://site.test/account/billing-portal'));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(`/auth/sign-in?returnTo=${encodeURIComponent('/account')}`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 500 when GATEWAY_API_URL is missing', async () => {
    const res = await callGet(
      buildContext('https://site.test/account/billing-portal', {
        cookieValue: SESSION_JWT,
        envOverride: { GATEWAY_API_URL: undefined },
      })
    );
    expect(res.status).toBe(500);
    expect(await res.text()).toMatch(/GATEWAY_API_URL/);
  });

  it('redirects to the Stripe portal URL on success', async () => {
    const portalUrl = 'https://billing.stripe.com/p/session/abc123';
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ url: portalUrl }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const res = await callGet(buildContext('https://site.test/account/billing-portal', { cookieValue: SESSION_JWT }));

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(portalUrl);
    expect(res.headers.get('Cache-Control')).toBe('no-store');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(`${GATEWAY}/api/billing/portal`);
    const headers = calledInit.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${SESSION_JWT}`);
    expect(JSON.parse(calledInit.body as string)).toEqual({
      returnUrl: 'https://site.test/account',
    });
  });

  it('strips trailing slashes from GATEWAY_API_URL', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ url: 'https://billing.stripe.com/p/session/x' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    await callGet(
      buildContext('https://site.test/account/billing-portal', {
        cookieValue: SESSION_JWT,
        envOverride: { GATEWAY_API_URL: `${GATEWAY}///` },
      })
    );
    const [calledUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(`${GATEWAY}/api/billing/portal`);
  });

  it('redirects to /pricing when gateway returns 404 (no subscription on file)', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'No active subscription found' }), { status: 404 })
    );
    const res = await callGet(buildContext('https://site.test/account/billing-portal', { cookieValue: SESSION_JWT }));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/pricing');
  });

  it('redirects to sign-in when gateway returns 401 (session token rejected)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('unauthorized', { status: 401 }));
    const res = await callGet(buildContext('https://site.test/account/billing-portal', { cookieValue: SESSION_JWT }));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(`/auth/sign-in?returnTo=${encodeURIComponent('/account')}`);
  });

  it('returns 502 when gateway returns 500', async () => {
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));
    const res = await callGet(buildContext('https://site.test/account/billing-portal', { cookieValue: SESSION_JWT }));
    expect(res.status).toBe(502);
  });

  it('returns 502 when fetch throws (network error)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = await callGet(buildContext('https://site.test/account/billing-portal', { cookieValue: SESSION_JWT }));
    expect(res.status).toBe(502);
  });

  it('returns 502 when gateway responds without url field', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const res = await callGet(buildContext('https://site.test/account/billing-portal', { cookieValue: SESSION_JWT }));
    expect(res.status).toBe(502);
  });
});
