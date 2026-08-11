import { describe, expect, it, vi } from 'vitest';
import { fetchPlans } from '~/utils/plans';
import { buildPricingCards } from '~/data/plan-features';

const LIVE = await (await fetch('https://api.deepacquire.com/api/plans')).json();

describe('live gateway payload', () => {
  it('validates and renders', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(LIVE), { status: 200, headers: { 'content-type': 'application/json' } })
    ) as never;

    const res = await fetchPlans({ runtime: { env: { GATEWAY_API_URL: 'https://api.deepacquire.com' } } } as never);
    expect(res.ok).toBe(true);

    const cards = buildPricingCards('zh-CN', res.ok ? res.data : null);
    console.log(JSON.stringify(cards.map((c) => ({ t: c.title, price: c.price, items: c.items?.map((i) => i.description) })), null, 1));
    for (const c of cards) expect(c.price).not.toBe('—');
  });
});
