import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '~/pages/auth/sso';
import { LOGTO_COOKIES } from '~/utils/auth/logto';

type FetchMock = ReturnType<typeof vi.fn>;

const SITE_SECRET = 'site-redeem-secret-value';
const GATEWAY = 'https://gateway.example.test';

const buildContext = (
  url: string,
  envOverride: Partial<{ SITE_REDEEM_SECRET: string; GATEWAY_API_URL: string }> = {}
) => {
  const env: Record<string, string | undefined> = {
    SITE_REDEEM_SECRET: SITE_SECRET,
    GATEWAY_API_URL: GATEWAY,
    ...envOverride,
  };
  return {
    request: new Request(url),
    locals: { runtime: { env } },
  };
  // The above shape matches what `Astro.locals` looks like under the Cloudflare adapter.
};

const callGet = async (ctx: ReturnType<typeof buildContext>) => {
  // Cast to the shape Astro APIRoute expects; we only use a small subset.
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
  vi.useRealTimers();
});

const okRedeem = (sessionJwt = 'fake.session.jwt', expiresAt?: number) =>
  new Response(
    JSON.stringify({
      sessionJwt,
      user: { sub: 'u1', email: 'u1@x', name: 'U', picture: 'https://x' },
      expiresAt,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );

describe('GET /auth/sso', () => {
  it('returns 400 when token is missing', async () => {
    const res = await callGet(buildContext('https://site.test/auth/sso'));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 400 when token is empty after trim', async () => {
    const res = await callGet(buildContext('https://site.test/auth/sso?token=%20%20'));
    expect(res.status).toBe(400);
  });

  it('returns 500 when SITE_REDEEM_SECRET is missing', async () => {
    const res = await callGet(buildContext('https://site.test/auth/sso?token=abc', { SITE_REDEEM_SECRET: undefined }));
    expect(res.status).toBe(500);
    expect(await res.text()).toMatch(/SITE_REDEEM_SECRET/);
  });

  it('returns 500 when GATEWAY_API_URL is missing', async () => {
    const res = await callGet(buildContext('https://site.test/auth/sso?token=abc', { GATEWAY_API_URL: undefined }));
    expect(res.status).toBe(500);
    expect(await res.text()).toMatch(/GATEWAY_API_URL/);
  });

  it('redirects to /account by default and sets the session cookie on success', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 1800;
    fetchMock.mockResolvedValueOnce(okRedeem('jwt-value', expiresAt));

    const res = await callGet(buildContext('https://site.test/auth/sso?token=handoff-uuid'));

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/account');
    expect(res.headers.get('Cache-Control')).toBe('no-store');

    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toBeTruthy();
    expect(setCookie!).toContain(`${LOGTO_COOKIES.idToken}=jwt-value`);
    expect(setCookie!).toContain('HttpOnly');
    expect(setCookie!).toContain('Secure');
    expect(setCookie!).toContain('SameSite=Lax');
    expect(setCookie!).toContain('Path=/');
    expect(setCookie!).toMatch(/Max-Age=\d+/);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(`${GATEWAY}/api/auth/redeem-handoff`);
    const headers = calledInit.headers as Record<string, string>;
    expect(headers['X-Site-Secret']).toBe(SITE_SECRET);
    expect(JSON.parse(calledInit.body as string)).toEqual({ token: 'handoff-uuid' });
  });

  it('respects safe returnTo paths', async () => {
    fetchMock.mockResolvedValueOnce(okRedeem());
    const res = await callGet(buildContext('https://site.test/auth/sso?token=abc&returnTo=/pricing'));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/pricing');
  });

  it('falls back to /account for unsafe returnTo (protocol-relative)', async () => {
    fetchMock.mockResolvedValueOnce(okRedeem());
    const res = await callGet(
      buildContext(`https://site.test/auth/sso?token=abc&returnTo=${encodeURIComponent('//evil.com')}`)
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/account');
  });

  it('falls back to /account for unsafe returnTo (absolute URL)', async () => {
    fetchMock.mockResolvedValueOnce(okRedeem());
    const res = await callGet(
      buildContext(`https://site.test/auth/sso?token=abc&returnTo=${encodeURIComponent('https://evil.com')}`)
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/account');
  });

  it('falls back to /account for unsafe returnTo (not starting with /)', async () => {
    fetchMock.mockResolvedValueOnce(okRedeem());
    const res = await callGet(
      buildContext(`https://site.test/auth/sso?token=abc&returnTo=${encodeURIComponent('../../etc')}`)
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/account');
  });

  it('returns 400 with helpful message when gateway returns 410', async () => {
    fetchMock.mockResolvedValueOnce(new Response('gone', { status: 410 }));
    const res = await callGet(buildContext('https://site.test/auth/sso?token=abc'));
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/expired/i);
  });

  it('returns 500 when gateway returns 401 (our misconfiguration)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('unauthorized', { status: 401 }));
    const res = await callGet(buildContext('https://site.test/auth/sso?token=abc'));
    expect(res.status).toBe(500);
  });

  it('returns 502 when gateway returns 500', async () => {
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));
    const res = await callGet(buildContext('https://site.test/auth/sso?token=abc'));
    expect(res.status).toBe(502);
  });

  it('returns 502 when fetch to gateway throws (network error)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = await callGet(buildContext('https://site.test/auth/sso?token=abc'));
    expect(res.status).toBe(502);
  });

  it('returns 502 when gateway returns 200 with malformed JSON', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('not-json', { status: 200, headers: { 'content-type': 'application/json' } })
    );
    const res = await callGet(buildContext('https://site.test/auth/sso?token=abc'));
    expect(res.status).toBe(502);
  });

  it('returns 502 when gateway returns 200 without sessionJwt', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { sub: 'x' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const res = await callGet(buildContext('https://site.test/auth/sso?token=abc'));
    expect(res.status).toBe(502);
  });

  it('omits Secure cookie attribute on plain http requests', async () => {
    fetchMock.mockResolvedValueOnce(okRedeem());
    const res = await callGet(buildContext('http://localhost:4321/auth/sso?token=abc'));
    expect(res.status).toBe(302);
    const setCookie = res.headers.get('Set-Cookie')!;
    expect(setCookie).not.toContain('Secure');
  });
});
