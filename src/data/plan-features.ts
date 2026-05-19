/**
 * Localized marketing copy for each pricing tier.
 *
 * The numeric data (price, credits, Stripe price IDs) lives on the gateway
 * worker (`/api/plans`); this file only owns the customer-facing display
 * strings — names, taglines, feature bullet lists, period labels, and CTA
 * targets. Update here when copy changes; update the worker's plans.json
 * when pricing/credit limits change.
 */

import type { PlanId } from '~/utils/plans';

export type Lang = 'en' | 'zh-CN' | 'zh-TW';

export interface LocalPlanContent {
  displayName: string;
  subtitle: string;
  period: string;
  items: { description: string }[];
  cta: { text: string; href: string; target?: string };
  hasRibbon?: boolean;
  ribbonTitle?: string;
}

const CHROME_STORE_URL = 'https://chrome.google.com/webstore/detail/pnobdlbfobamledoecdignpneeoohhio';

export const PLAN_CONTENT: Record<Lang, Record<PlanId, LocalPlanContent>> = {
  en: {
    free: {
      displayName: 'Free',
      subtitle: 'Get started at no cost',
      period: 'forever',
      items: [
        { description: 'Custom AI Provider' },
        { description: 'Advanced Word Analysis' },
        { description: 'Vocabulary Sync' },
        { description: '200 credits / month' },
        { description: 'AI Translation (based on credits, 200 credits ≈ 60 mins)' },
        { description: 'Subtitle Enhance (free during preview)' },
        { description: 'ASR Transcription (free during preview)' },
      ],
      cta: {
        text: 'Get Started',
        href: CHROME_STORE_URL,
        target: '_blank',
      },
    },
    plus: {
      displayName: 'Plus',
      subtitle: 'For everyday learners',
      period: 'per month',
      items: [
        { description: 'Custom AI Provider' },
        { description: 'Advanced Word Analysis' },
        { description: 'Vocabulary Sync' },
        { description: '1,800 credits / month' },
        { description: 'AI Translation (based on credits, 9x usage of Free plan)' },
        { description: 'Subtitle Enhance (free during preview)' },
        { description: 'ASR Transcription (free during preview)' },
      ],
      cta: {
        text: 'Subscribe',
        href: '/checkout/plus',
      },
    },
    pro: {
      displayName: 'Pro',
      subtitle: 'For regular immersion',
      period: 'per month',
      items: [
        { description: 'Custom AI Provider' },
        { description: 'Advanced Word Analysis' },
        { description: 'Vocabulary Sync' },
        { description: '3,000 credits / month' },
        { description: 'AI Translation (based on credits, 1.67x usage of Plus plan)' },
        { description: 'Subtitle Enhance (free during preview)' },
        { description: 'ASR Transcription (free during preview)' },
      ],
      cta: {
        text: 'Subscribe',
        href: '/checkout/pro',
      },
      hasRibbon: true,
      ribbonTitle: 'popular',
    },
    max: {
      displayName: 'Max',
      subtitle: 'For power users',
      period: 'per month',
      items: [
        { description: 'Custom AI Provider' },
        { description: 'Advanced Word Analysis' },
        { description: 'Vocabulary Sync' },
        { description: '6,000 credits / month' },
        { description: 'AI Translation (based on credits, 2x usage of Pro plan)' },
        { description: 'Subtitle Enhance (free during preview)' },
        { description: 'ASR Transcription (free during preview)' },
      ],
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
      items: [
        { description: '自定义 AI 服务商' },
        { description: '高级单词分析' },
        { description: '生词本同步' },
        { description: '200 积分 / 月' },
        { description: 'AI 翻译（按积分计算，200 积分约 60 分钟）' },
        { description: '字幕增强（预览期间免费）' },
        { description: '语音识别转写（预览期间免费）' },
      ],
      cta: {
        text: '立即开始',
        href: CHROME_STORE_URL,
        target: '_blank',
      },
    },
    plus: {
      displayName: 'Plus 版',
      subtitle: '适合日常学习者',
      period: '每月',
      items: [
        { description: '自定义 AI 服务商' },
        { description: '高级单词分析' },
        { description: '生词本同步' },
        { description: '1,800 积分 / 月' },
        { description: 'AI 翻译（按积分计算，9 倍免费版用量）' },
        { description: '字幕增强（预览期间免费）' },
        { description: '语音识别转写（预览期间免费）' },
      ],
      cta: {
        text: '立即订阅',
        href: '/checkout/plus',
      },
    },
    pro: {
      displayName: 'Pro 版',
      subtitle: '适合进阶沉浸学习',
      period: '每月',
      items: [
        { description: '自定义 AI 服务商' },
        { description: '高级单词分析' },
        { description: '生词本同步' },
        { description: '3,000 积分 / 月' },
        { description: 'AI 翻译（按积分计算，1.67 倍 Plus 版用量）' },
        { description: '字幕增强（预览期间免费）' },
        { description: '语音识别转写（预览期间免费）' },
      ],
      cta: {
        text: '立即订阅',
        href: '/checkout/pro',
      },
      hasRibbon: true,
      ribbonTitle: '热门',
    },
    max: {
      displayName: 'Max 版',
      subtitle: '适合深度用户',
      period: '每月',
      items: [
        { description: '自定义 AI 服务商' },
        { description: '高级单词分析' },
        { description: '生词本同步' },
        { description: '6,000 积分 / 月' },
        { description: 'AI 翻译（按积分计算，2 倍 Pro 版用量）' },
        { description: '字幕增强（预览期间免费）' },
        { description: '语音识别转写（预览期间免费）' },
      ],
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
      items: [
        { description: '自訂 AI 服務商' },
        { description: '進階單字分析' },
        { description: '生字本同步' },
        { description: '200 點數 / 月' },
        { description: 'AI 翻譯（按點數計算，200 點數約 60 分鐘）' },
        { description: '字幕強化（預覽期間免費）' },
        { description: '語音辨識轉寫（預覽期間免費）' },
      ],
      cta: {
        text: '立即開始',
        href: CHROME_STORE_URL,
        target: '_blank',
      },
    },
    plus: {
      displayName: 'Plus 版',
      subtitle: '適合日常學習者',
      period: '每月',
      items: [
        { description: '自訂 AI 服務商' },
        { description: '進階單字分析' },
        { description: '生字本同步' },
        { description: '1,800 點數 / 月' },
        { description: 'AI 翻譯（按點數計算，9 倍免費版用量）' },
        { description: '字幕強化（預覽期間免費）' },
        { description: '語音辨識轉寫（預覽期間免費）' },
      ],
      cta: {
        text: '立即訂閱',
        href: '/checkout/plus',
      },
    },
    pro: {
      displayName: 'Pro 版',
      subtitle: '適合進階沉浸學習',
      period: '每月',
      items: [
        { description: '自訂 AI 服務商' },
        { description: '進階單字分析' },
        { description: '生字本同步' },
        { description: '3,000 點數 / 月' },
        { description: 'AI 翻譯（按點數計算，1.67 倍 Plus 版用量）' },
        { description: '字幕強化（預覽期間免費）' },
        { description: '語音辨識轉寫（預覽期間免費）' },
      ],
      cta: {
        text: '立即訂閱',
        href: '/checkout/pro',
      },
      hasRibbon: true,
      ribbonTitle: '熱門',
    },
    max: {
      displayName: 'Max 版',
      subtitle: '適合進階使用者',
      period: '每月',
      items: [
        { description: '自訂 AI 服務商' },
        { description: '進階單字分析' },
        { description: '生字本同步' },
        { description: '6,000 點數 / 月' },
        { description: 'AI 翻譯（按點數計算，2 倍 Pro 版用量）' },
        { description: '字幕強化（預覽期間免費）' },
        { description: '語音辨識轉寫（預覽期間免費）' },
      ],
      cta: {
        text: '立即訂閱',
        href: '/checkout/max',
      },
    },
  },
};
