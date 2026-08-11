import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildPricingCards, pricingTrialNote, trialClause } from '~/data/plan-features';
import { fetchPlans, type CreditPeriod, type PlansData } from '~/utils/plans';

/** Mirrors the live gateway payload so the derived copy is checked end to end. */
const PLANS: PlansData = {
  version: 6,
  trialDays: 7,
  plans: [
    {
      id: 'free',
      displayName: 'Free',
      tier: 0,
      sharedCredits: 20,
      creditPeriod: 'day',
      priceUsd: 0,
      stripePriceId: null,
    },
    {
      id: 'plus',
      displayName: 'Plus',
      tier: 1,
      sharedCredits: 2000,
      creditPeriod: 'month',
      priceUsd: 3,
      stripePriceId: 'price_plus',
    },
    {
      id: 'pro',
      displayName: 'Pro',
      tier: 2,
      sharedCredits: 3500,
      creditPeriod: 'month',
      priceUsd: 4.98,
      stripePriceId: 'price_pro',
    },
    {
      id: 'max',
      displayName: 'Max',
      tier: 3,
      sharedCredits: 7000,
      creditPeriod: 'month',
      priceUsd: 9.98,
      stripePriceId: 'price_max',
    },
  ],
};

const bulletsOf = (lang: Parameters<typeof buildPricingCards>[0], planIndex: number): string[] =>
  (buildPricingCards(lang, PLANS)[planIndex].items ?? []).map((item) => item.description ?? '');

describe('buildPricingCards', () => {
  it('derives the credit allowance and cadence from the payload', () => {
    expect(bulletsOf('en', 0)).toContain('20 credits / day');
    expect(bulletsOf('en', 0)).toContain('Resets every day');
    expect(bulletsOf('zh-CN', 0)).toContain('20 积分 / 天');
    expect(bulletsOf('zh-TW', 0)).toContain('20 點數 / 天');
    expect(bulletsOf('en', 1).some((b) => b.startsWith('2,000 credits / month'))).toBe(true);
  });

  it('computes cross-tier multipliers, normalizing shorter cadences to a month', () => {
    // Plus is compared against a tier that resets daily, so its ratio only
    // holds once the free allowance is scaled up to a month.
    expect(bulletsOf('en', 1)).toContain('2,000 credits / month, 3.33x usage of Free plan');
    expect(bulletsOf('zh-CN', 1)).toContain('2,000 积分 / 月，约 3.33 倍 免费版用量');
    expect(bulletsOf('en', 2)).toContain('3,500 credits / month, 1.75x usage of Plus plan');
    expect(bulletsOf('en', 3)).toContain('7,000 credits / month, 2x usage of Pro plan');
    expect(bulletsOf('zh-CN', 2)).toContain('3,500 积分 / 月，约 1.75 倍 Plus 版用量');
    expect(bulletsOf('zh-TW', 3)).toContain('7,000 點數 / 月，2 倍 Pro 版用量');
  });

  it('derives the trial bullet from trialDays and omits it on the free tier', () => {
    expect(bulletsOf('en', 1)).toContain('7-day free trial');
    expect(bulletsOf('zh-CN', 1)).toContain('7 天免费试用');
    expect(bulletsOf('en', 0).some((b) => /trial/i.test(b))).toBe(false);
  });

  it('carries price, period label and CTA through unchanged', () => {
    const [free, plus] = buildPricingCards('en', PLANS);

    expect(free.price).toBe('0');
    expect(free.period).toBe('forever');
    expect(plus.price).toBe(3);
    expect(plus.callToAction).toMatchObject({ href: '/checkout/plus' });
    expect(plus.hasRibbon).toBe(true);
  });

  it('never renders a hardcoded credit figure — every card reflects the payload', () => {
    const doubled: PlansData = {
      ...PLANS,
      plans: PLANS.plans.map((p) => ({ ...p, sharedCredits: p.sharedCredits * 2 })),
    };

    expect(bulletsOf('en', 0)).toContain('20 credits / day');
    expect((buildPricingCards('en', doubled)[0].items ?? []).map((i) => i.description)).toContain('40 credits / day');
  });
});

/**
 * Every cadence the gateway may send has to survive the whole pipeline, so
 * these cases start from a gateway response rather than from a `PlansData`
 * literal. `fetchPlans` guards `creditPeriod` against a hand-maintained
 * whitelist that `Set<CreditPeriod>` does not force to list every member of
 * the union, and an omission there rejects the *entire* payload: the pricing
 * page then blanks every price and disables checkout, rather than losing just
 * the one bullet that cadence feeds.
 */
describe('cadence support, from gateway response to rendered bullet', () => {
  const GATEWAY = 'https://gateway.example.test';
  const LOCALS = { runtime: { env: { GATEWAY_API_URL: GATEWAY } } } as unknown as App.Locals;

  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  /** Serve `PLANS` with the free tier switched to `creditPeriod`, then render it. */
  const renderFreeTier = async (creditPeriod: CreditPeriod): Promise<string[]> => {
    const payload: PlansData = {
      ...PLANS,
      plans: PLANS.plans.map((p) => (p.id === 'free' ? { ...p, creditPeriod } : p)),
    };
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
      ) as unknown as typeof globalThis.fetch;

    const result = await fetchPlans(LOCALS);
    if (!result.ok) throw new Error(`fetchPlans rejected creditPeriod "${creditPeriod}": ${result.detail}`);

    return (buildPricingCards('en', result.data)[0].items ?? []).map((item) => item.description ?? '');
  };

  const cases: ReadonlyArray<[CreditPeriod, string, string]> = [
    ['day', '20 credits / day', 'Resets every day'],
    ['week', '20 credits / week', 'Resets every 7 days'],
    ['month', '20 credits / month', 'Resets every 30 days'],
  ];

  it.each(cases)('accepts a %s cadence and states when it resets', async (creditPeriod, allowance, resetNote) => {
    const bullets = await renderFreeTier(creditPeriod);

    expect(bullets).toContain(allowance);
    expect(bullets).toContain(resetNote);
  });
});

describe('buildPricingCards without live plan data', () => {
  const skeleton = buildPricingCards('en', null);
  const skeletonBullets = (index: number) => (skeleton[index].items ?? []).map((item) => item.description ?? '');

  it('still renders every tier, in order, with its copy intact', () => {
    expect(skeleton.map((card) => card.title)).toEqual(['Free', 'Plus', 'Pro', 'Max']);
    expect(skeletonBullets(0)).toContain('Custom AI Provider');
    expect(skeletonBullets(1)).toContain('All Free plan features');
  });

  it('replaces every live figure with a dash instead of a stale number', () => {
    for (const card of skeleton) {
      expect(card.price).toBe('—');
    }
    expect(skeletonBullets(0)).toContain('— credits');
    expect(skeletonBullets(1)).toContain('— credits');
    // Cadence, trial length and multipliers are not guessable offline, so the
    // bullets carrying them are dropped or stripped rather than filled in.
    expect(skeletonBullets(0).some((b) => /Resets every/.test(b))).toBe(false);
    expect(skeletonBullets(1)).toContain('Free trial');
    expect(skeletonBullets(2).some((b) => /x usage of/.test(b))).toBe(false);
  });

  it('drops the href on checkout actions so the widget renders them inert', () => {
    expect(skeleton[1].callToAction).toEqual({ text: 'Subscribe' });
    expect(skeleton[2].callToAction).toEqual({ text: 'Subscribe' });
    expect(skeleton[3].callToAction).toEqual({ text: 'Subscribe' });
  });

  it('keeps the free tier install link working — it does not depend on pricing', () => {
    expect(skeleton[0].callToAction).toMatchObject({ href: expect.stringContaining('chrome.google.com') });
  });

  it('localizes the placeholder unit', () => {
    expect((buildPricingCards('zh-CN', null)[0].items ?? []).map((i) => i.description)).toContain('— 积分');
    expect((buildPricingCards('zh-TW', null)[0].items ?? []).map((i) => i.description)).toContain('— 點數');
  });
});

describe('trial copy', () => {
  it('drops the duration rather than inventing one when trialDays is unknown', () => {
    expect(trialClause('en', 7)).toBe('include a 7-day free trial');
    expect(trialClause('en', undefined)).toBe('include a free trial');
    expect(pricingTrialNote('en', 7)).toBe('All paid plans include a 7-day free trial');
    expect(pricingTrialNote('zh-CN', 7)).toBe('所有付费方案均含 7 天免费试用');
    expect(pricingTrialNote('zh-CN', undefined)).toBe('所有付费方案均含免费试用');
    expect(pricingTrialNote('zh-TW', 7)).toBe('所有付費方案均含 7 天免費試用');
  });
});
