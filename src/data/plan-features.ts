/**
 * Localized marketing copy for each pricing tier.
 *
 * This file owns **words only**. Every number a visitor sees — credit
 * allowances, reset cadence, trial length, cross-tier multipliers — is
 * interpolated from the gateway's `/api/plans` payload at render time, so
 * `gateway-worker/src/config/plans.json` stays the only place a price or quota
 * is ever edited. Do not reintroduce literal credit counts below.
 *
 * When that payload is unavailable the cards still render, with an em dash
 * wherever a live figure would go and the checkout actions made inert — see
 * `buildPricingCards`. There is deliberately no bundled snapshot to fall back
 * on: a stale mirror advertises prices we no longer honour.
 */

import { PLAN_IDS, type PlanFromApi, type PlanId, type PlansData } from '~/utils/plans';
import type { Price } from '~/types';

export type Lang = 'en' | 'zh-CN' | 'zh-TW';

/**
 * Throughput calibration for the AI-translation bullet: how much watch time a
 * fixed credit budget buys. This is a rate, independent of any plan's
 * allowance, which is why it lives here rather than in plans.json.
 */
const TRANSLATION_SAMPLE_CREDITS = 100;
const TRANSLATION_SAMPLE_MINUTES = 30;

/**
 * Weeks per month used to compare a weekly allowance against a monthly one
 * (e.g. "10x Free"). Matches the ratios quoted in plans.json's own copy.
 */
const WEEKS_PER_MONTH = 4;

/** Stand-in for any figure we could not load. */
const MISSING = '—';

const CHROME_STORE_URL = 'https://chrome.google.com/webstore/detail/pnobdlbfobamledoecdignpneeoohhio';

/** Interpolated fragments handed to a tier's bullet builder. Empty = drop the bullet. */
interface PlanCopyContext {
  /** "2,000 credits / month", or "— credits" with no live data. */
  credits: string;
  /** "7-day free trial", or "Free trial" when the length is unknown. */
  trial: string;
  /** "Resets every 7 days". Empty when the cadence is unknown. */
  resetNote: string;
  /** ", 1.75x usage of Plus plan". Empty when the ratio cannot be computed. */
  comparison: string;
}

interface PlanCopy {
  displayName: string;
  subtitle: string;
  /** Label under the price, e.g. "per month". Never carries a live figure. */
  period: string;
  items: (ctx: PlanCopyContext) => string[];
  cta: { text: string; href: string; target?: string };
  hasRibbon?: boolean;
  ribbonTitle?: string;
}

const PLAN_COPY: Record<Lang, Record<PlanId, PlanCopy>> = {
  en: {
    free: {
      displayName: 'Free',
      subtitle: 'Get started at no cost',
      period: 'forever',
      items: (c) => [
        c.credits,
        c.resetNote,
        'Custom AI Provider',
        'Advanced Word Analysis',
        'Vocabulary Sync',
        `AI Translation (based on credits, ${TRANSLATION_SAMPLE_CREDITS} credits ≈ ${TRANSLATION_SAMPLE_MINUTES} mins)`,
        'Subtitle Enhance (free during preview)',
        'ASR Transcription (free during preview)',
      ],
      cta: {
        text: 'Get Started',
        href: CHROME_STORE_URL,
        target: '_blank',
      },
    },
    plus: {
      displayName: 'Plus',
      subtitle: 'For light daily use',
      period: 'per month',
      items: (c) => [c.trial, c.credits, 'All Free plan features'],
      cta: {
        text: 'Subscribe',
        href: '/checkout/plus',
      },
      hasRibbon: true,
      ribbonTitle: 'popular',
    },
    pro: {
      displayName: 'Pro',
      subtitle: 'For regular immersion',
      period: 'per month',
      items: (c) => [c.trial, `${c.credits}${c.comparison}`, 'All Plus plan features'],
      cta: {
        text: 'Subscribe',
        href: '/checkout/pro',
      },
    },
    max: {
      displayName: 'Max',
      subtitle: 'For power users',
      period: 'per month',
      items: (c) => [c.trial, `${c.credits}${c.comparison}`, 'All Pro plan features'],
      cta: {
        text: 'Subscribe',
        href: '/checkout/max',
      },
    },
  },
  'zh-CN': {
    free: {
      displayName: '免费版',
      subtitle: '零成本上手体验',
      period: '永久免费',
      items: (c) => [
        c.credits,
        c.resetNote,
        '自定义 AI 服务商',
        '高级单词分析',
        '生词本同步',
        `AI 翻译（按积分计算，${TRANSLATION_SAMPLE_CREDITS} 积分约 ${TRANSLATION_SAMPLE_MINUTES} 分钟）`,
        '字幕增强（预览期间免费）',
        '语音识别转写（预览期间免费）',
      ],
      cta: {
        text: '立即开始',
        href: CHROME_STORE_URL,
        target: '_blank',
      },
    },
    plus: {
      displayName: 'Plus 版',
      subtitle: '适合轻度日常使用',
      period: '每月',
      items: (c) => [c.trial, c.credits, '包含免费版全部功能'],
      cta: {
        text: '立即订阅',
        href: '/checkout/plus',
      },
      hasRibbon: true,
      ribbonTitle: '热门',
    },
    pro: {
      displayName: 'Pro 版',
      subtitle: '适合常规沉浸学习',
      period: '每月',
      items: (c) => [c.trial, `${c.credits}${c.comparison}`, '包含 Plus 版全部功能'],
      cta: {
        text: '立即订阅',
        href: '/checkout/pro',
      },
    },
    max: {
      displayName: 'Max 版',
      subtitle: '适合深度用户',
      period: '每月',
      items: (c) => [c.trial, `${c.credits}${c.comparison}`, '包含 Pro 版全部功能'],
      cta: {
        text: '立即订阅',
        href: '/checkout/max',
      },
    },
  },
  'zh-TW': {
    free: {
      displayName: '免費版',
      subtitle: '零成本立即上手',
      period: '永久免費',
      items: (c) => [
        c.credits,
        c.resetNote,
        '自訂 AI 服務商',
        '進階單字分析',
        '生字本同步',
        `AI 翻譯（按點數計算，${TRANSLATION_SAMPLE_CREDITS} 點數約 ${TRANSLATION_SAMPLE_MINUTES} 分鐘）`,
        '字幕強化（預覽期間免費）',
        '語音辨識轉寫（預覽期間免費）',
      ],
      cta: {
        text: '立即開始',
        href: CHROME_STORE_URL,
        target: '_blank',
      },
    },
    plus: {
      displayName: 'Plus 版',
      subtitle: '適合輕度日常使用',
      period: '每月',
      items: (c) => [c.trial, c.credits, '包含免費版全部功能'],
      cta: {
        text: '立即訂閱',
        href: '/checkout/plus',
      },
      hasRibbon: true,
      ribbonTitle: '熱門',
    },
    pro: {
      displayName: 'Pro 版',
      subtitle: '適合常規沉浸學習',
      period: '每月',
      items: (c) => [c.trial, `${c.credits}${c.comparison}`, '包含 Plus 版全部功能'],
      cta: {
        text: '立即訂閱',
        href: '/checkout/pro',
      },
    },
    max: {
      displayName: 'Max 版',
      subtitle: '適合進階使用者',
      period: '每月',
      items: (c) => [c.trial, `${c.credits}${c.comparison}`, '包含 Pro 版全部功能'],
      cta: {
        text: '立即訂閱',
        href: '/checkout/max',
      },
    },
  },
};

const CREDIT_UNIT: Record<Lang, string> = { en: 'credits', 'zh-CN': '积分', 'zh-TW': '點數' };
const PERIOD_NOUN: Record<Lang, Record<PlanFromApi['creditPeriod'], string>> = {
  en: { week: 'week', month: 'month' },
  'zh-CN': { week: '周', month: '月' },
  'zh-TW': { week: '週', month: '月' },
};
const PERIOD_DAYS: Record<PlanFromApi['creditPeriod'], number> = { week: 7, month: 30 };

/** Localized display name for a plan, used outside the pricing table. */
export const getPlanDisplayName = (lang: Lang, planId: PlanId): string => PLAN_COPY[lang][planId].displayName;

/**
 * Sentence fragment describing the trial, e.g. "include a 7-day free trial" /
 * "含 7 天免费试用". Returned as a whole clause so callers never have to worry
 * about the space that CJK copy needs before a numeral.
 *
 * When the trial length is unknown (plan data failed to load) the duration is
 * dropped rather than guessed.
 */
export const trialClause = (lang: Lang, trialDays?: number): string => {
  const hasDays = typeof trialDays === 'number' && trialDays > 0;
  switch (lang) {
    case 'zh-CN':
      return hasDays ? `含 ${trialDays} 天免费试用` : '含免费试用';
    case 'zh-TW':
      return hasDays ? `含 ${trialDays} 天免費試用` : '含免費試用';
    default:
      return hasDays ? `include a ${trialDays}-day free trial` : 'include a free trial';
  }
};

/** Banner under the pricing headline, e.g. "All paid plans include a 7-day free trial". */
export const pricingTrialNote = (lang: Lang, trialDays?: number): string => {
  const clause = trialClause(lang, trialDays);
  switch (lang) {
    case 'zh-CN':
      return `所有付费方案均${clause}`;
    case 'zh-TW':
      return `所有付費方案均${clause}`;
    default:
      return `All paid plans ${clause}`;
  }
};

/** Replaces the trial banner when the cards are rendered without live figures. */
export const pricingUnavailableNote = (lang: Lang): string => {
  switch (lang) {
    case 'zh-CN':
      return '暂时无法获取实时价格，具体额度与金额稍后显示，请几分钟后重试';
    case 'zh-TW':
      return '暫時無法取得即時價格，具體額度與金額稍後顯示，請幾分鐘後重試';
    default:
      return 'Live pricing is temporarily unavailable — figures will appear once it loads. Please try again shortly.';
  }
};

const creditsPhrase = (lang: Lang, plan?: PlanFromApi): string =>
  plan
    ? `${plan.sharedCredits.toLocaleString('en-US')} ${CREDIT_UNIT[lang]} / ${PERIOD_NOUN[lang][plan.creditPeriod]}`
    : `${MISSING} ${CREDIT_UNIT[lang]}`;

const trialBullet = (lang: Lang, trialDays?: number): string => {
  const hasDays = typeof trialDays === 'number' && trialDays > 0;
  switch (lang) {
    case 'zh-CN':
      return hasDays ? `${trialDays} 天免费试用` : '免费试用';
    case 'zh-TW':
      return hasDays ? `${trialDays} 天免費試用` : '免費試用';
    default:
      return hasDays ? `${trialDays}-day free trial` : 'Free trial';
  }
};

const resetNote = (lang: Lang, plan?: PlanFromApi): string => {
  if (!plan) return '';
  const days = PERIOD_DAYS[plan.creditPeriod];
  switch (lang) {
    case 'zh-CN':
      return `每 ${days} 天重置一次`;
    case 'zh-TW':
      return `每 ${days} 天重置一次`;
    default:
      return `Resets every ${days} days`;
  }
};

/** Normalize an allowance to credits-per-month so tiers on different cadences compare. */
const monthlyCredits = (plan: PlanFromApi): number =>
  plan.creditPeriod === 'week' ? plan.sharedCredits * WEEKS_PER_MONTH : plan.sharedCredits;

const comparisonPhrase = (lang: Lang, plan?: PlanFromApi, lower?: PlanFromApi): string => {
  if (!plan || !lower) return '';
  const lowerMonthly = monthlyCredits(lower);
  if (lowerMonthly <= 0) return '';

  const ratio = Math.round((monthlyCredits(plan) / lowerMonthly) * 100) / 100;
  // "1.75x" needs a hedge in Chinese copy; a whole multiple does not.
  const approx = !Number.isInteger(ratio);
  const lowerName = PLAN_COPY[lang][lower.id].displayName;

  switch (lang) {
    case 'zh-CN':
      return `，${approx ? '约 ' : ''}${ratio} 倍 ${lowerName}用量`;
    case 'zh-TW':
      return `，${approx ? '約 ' : ''}${ratio} 倍 ${lowerName}用量`;
    default:
      return `, ${ratio}x usage of ${lowerName} plan`;
  }
};

/** A CTA that starts a purchase, and therefore must not be offered without live prices. */
const isCheckoutAction = (href: string): boolean => href.startsWith('/checkout/');

/**
 * Turn the gateway payload into the props the Pricing widget renders.
 *
 * Pass `null` when the payload could not be loaded: the cards keep their shape
 * and their copy, every live figure becomes an em dash, and checkout actions
 * lose their `href` so the widget renders them inert. The free tier's
 * install link is untouched — it does not depend on pricing.
 */
export function buildPricingCards(lang: Lang, data: PlansData | null): Price[] {
  const order: readonly PlanId[] = data ? data.plans.map((p) => p.id) : PLAN_IDS;

  return order.map((planId, index) => {
    const copy = PLAN_COPY[lang][planId];
    const plan = data?.plans[index];
    const lower = index > 0 ? data?.plans[index - 1] : undefined;

    const items = copy
      .items({
        credits: creditsPhrase(lang, plan),
        trial: trialBullet(lang, data?.trialDays),
        resetNote: resetNote(lang, plan),
        comparison: comparisonPhrase(lang, plan, lower),
      })
      .filter((description) => description.length > 0)
      .map((description) => ({ description }));

    const blocked = !plan && isCheckoutAction(copy.cta.href);

    return {
      title: copy.displayName,
      subtitle: copy.subtitle,
      price: plan ? (plan.priceUsd === 0 ? '0' : plan.priceUsd) : MISSING,
      period: copy.period,
      items,
      callToAction: blocked ? { text: copy.cta.text } : copy.cta,
      hasRibbon: copy.hasRibbon,
      ribbonTitle: copy.ribbonTitle,
    };
  });
}
