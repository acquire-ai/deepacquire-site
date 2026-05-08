/**
 * Plans helper: fetch live plan metadata from gateway worker (`/api/plans`)
 * with a hard 5s timeout and a static fallback so the site continues to
 * render even when the API is unreachable.
 *
 * Single source of truth lives in `gateway-worker/src/config/plans.json`.
 * The FALLBACK_PLANS constant below mirrors that file and must be kept in
 * sync whenever pricing / credits change there.
 */

export type PlanId = 'free' | 'pro' | 'max' | 'ultra';

export interface PlanFromApi {
  id: PlanId;
  displayName: string;
  tagline?: string;
  tier: number;
  sharedCredits: number;
  priceUsd: number;
  stripePriceId: string | null;
  stripePriceIdYearly?: string | null;
}

interface PlansApiResponse {
  version?: number;
  plans: PlanFromApi[];
}

const FETCH_TIMEOUT_MS = 5000;

const FALLBACK_PLANS: PlanFromApi[] = [
  {
    id: 'free',
    displayName: 'Free',
    tagline: 'Get started',
    tier: 0,
    sharedCredits: 200,
    priceUsd: 0,
    stripePriceId: null,
    stripePriceIdYearly: null,
  },
  {
    id: 'pro',
    displayName: 'Pro',
    tagline: 'For everyday learners',
    tier: 1,
    sharedCredits: 1800,
    priceUsd: 3,
    stripePriceId: 'price_1TGyhECLGbk1ApqBZFw604u8',
    stripePriceIdYearly: null,
  },
  {
    id: 'max',
    displayName: 'Max',
    tagline: 'For power users',
    tier: 2,
    sharedCredits: 6000,
    priceUsd: 9.98,
    stripePriceId: 'price_1TGymSCLGbk1ApqBY17xslva',
    stripePriceIdYearly: null,
  },
  {
    id: 'ultra',
    displayName: 'Ultra',
    tagline: 'Maximum throughput',
    tier: 3,
    sharedCredits: 15000,
    priceUsd: 25,
    stripePriceId: null,
    stripePriceIdYearly: null,
  },
];

const getEnv = (key: string, locals?: App.Locals): string | undefined => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runtime = (locals as any)?.runtime?.env as Record<string, string> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vite = (import.meta as any).env as Record<string, string | undefined> | undefined;
  return runtime?.[key] ?? vite?.[key];
};

const sortByTier = (plans: PlanFromApi[]): PlanFromApi[] => [...plans].sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0));

const isValidPlan = (plan: unknown): plan is PlanFromApi => {
  if (!plan || typeof plan !== 'object') return false;
  const p = plan as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.displayName === 'string' &&
    typeof p.tier === 'number' &&
    typeof p.sharedCredits === 'number' &&
    typeof p.priceUsd === 'number'
  );
};

/**
 * Fetch plans from the gateway worker. Falls back to a built-in snapshot
 * on any error (network failure, timeout, non-2xx, malformed body).
 *
 * Result is sorted ascending by `tier` so callers can render in order
 * without an extra pass.
 */
export async function fetchPlans(locals?: App.Locals): Promise<PlanFromApi[]> {
  const gatewayUrl = getEnv('GATEWAY_API_URL', locals);
  if (!gatewayUrl) {
    return sortByTier(FALLBACK_PLANS);
  }

  try {
    const res = await fetch(`${gatewayUrl.replace(/\/$/, '')}/api/plans`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[plans] /api/plans returned ${res.status}, using fallback`);
      return sortByTier(FALLBACK_PLANS);
    }

    const body = (await res.json()) as Partial<PlansApiResponse>;
    if (!body || !Array.isArray(body.plans) || body.plans.length === 0) {
      console.warn('[plans] /api/plans returned empty/invalid body, using fallback');
      return sortByTier(FALLBACK_PLANS);
    }

    const valid = body.plans.filter(isValidPlan);
    if (valid.length === 0) {
      console.warn('[plans] /api/plans returned no valid plans, using fallback');
      return sortByTier(FALLBACK_PLANS);
    }

    return sortByTier(valid);
  } catch (err) {
    console.warn('[plans] failed to fetch /api/plans, using fallback:', err);
    return sortByTier(FALLBACK_PLANS);
  }
}

/**
 * Build a `{ planId: stripePriceId }` map, skipping plans without a
 * configured Stripe price (e.g. free tier or upcoming tiers).
 */
export function getPriceIdMap(plans: PlanFromApi[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const plan of plans) {
    if (plan.stripePriceId) {
      map[plan.id] = plan.stripePriceId;
    }
  }
  return map;
}

export { FALLBACK_PLANS };
