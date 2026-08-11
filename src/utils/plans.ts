/**
 * Plans helper.
 *
 * `gateway-worker/src/config/plans.json`, served as `GET /api/plans`, is the
 * single source of truth for prices, credit limits, reset cadence and Stripe
 * price ids. This module deliberately keeps **no local mirror** of that data:
 * a mirror has to be edited in lockstep with the gateway and, when someone
 * forgets, the site quietly advertises numbers we no longer honour.
 *
 * So every failure path here is fatal by design. Callers get `{ ok: false }`,
 * must render a placeholder instead of prices, and must not let the visitor
 * continue into checkout. Each failure also emits one alert-grade log line
 * containing `PLAN_METADATA_UNAVAILABLE`, which is the token to alert on.
 */

/**
 * Plan ids the site holds localized copy for, in display order. Doubles as the
 * skeleton order when live plan data is unavailable.
 */
export const PLAN_IDS = ['free', 'plus', 'pro', 'max'] as const;

export type PlanId = (typeof PLAN_IDS)[number];

/** Cadence at which a plan's credit bucket resets. Mirrors the gateway enum. */
export type CreditPeriod = 'day' | 'week' | 'month';

export interface PlanFromApi {
  id: PlanId;
  displayName: string;
  tagline?: string;
  tier: number;
  sharedCredits: number;
  creditPeriod: CreditPeriod;
  priceUsd: number;
  stripePriceId: string | null;
  stripePriceIdYearly?: string | null;
}

export interface PlansData {
  version: number;
  /** Free trial length in days applied to every paid plan. 0 = disabled. */
  trialDays: number;
  /** Plans sorted ascending by `tier`. */
  plans: PlanFromApi[];
}

export type PlansFailureReason =
  | 'missing_gateway_url'
  | 'http_error'
  | 'network_error'
  | 'malformed_body'
  | 'invalid_plan'
  | 'unknown_plan_id'
  | 'free_plan_missing';

export type PlansResult = { ok: true; data: PlansData } | { ok: false; reason: PlansFailureReason; detail: string };

const FETCH_TIMEOUT_MS = 5000;
const CREDIT_PERIODS: ReadonlySet<string> = new Set<CreditPeriod>(['day', 'week', 'month']);
const KNOWN_PLAN_IDS: ReadonlySet<string> = new Set<string>(PLAN_IDS);

interface PlansApiResponse {
  version?: unknown;
  trialDays?: unknown;
  plans?: unknown;
}

const getEnv = (key: string, locals?: App.Locals): string | undefined => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runtime = (locals as any)?.runtime?.env as Record<string, string> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vite = (import.meta as any).env as Record<string, string | undefined> | undefined;
  return runtime?.[key] ?? vite?.[key];
};

/**
 * Emit the one log line that monitoring alerts on. Kept as a single
 * `console.error` with a stable, greppable token so a Cloudflare Logpush /
 * `wrangler tail` filter on `PLAN_METADATA_UNAVAILABLE` catches every cause.
 */
const alertPlansUnavailable = (reason: PlansFailureReason, detail: string): void => {
  console.error(
    `[ALERT] PLAN_METADATA_UNAVAILABLE ${JSON.stringify({
      source: 'GET /api/plans',
      reason,
      detail,
      impact: 'pricing pages render a placeholder and checkout is blocked',
    })}`
  );
};

const fail = (reason: PlansFailureReason, detail: string): PlansResult => {
  alertPlansUnavailable(reason, detail);
  return { ok: false, reason, detail };
};

/**
 * Validate one plan entry. Anything missing means we cannot render that plan
 * truthfully, so it is reported rather than defaulted — including
 * `creditPeriod`, which older gateway deployments do not send yet. Deploy the
 * gateway before the site.
 */
const describeInvalidPlan = (plan: unknown): string | null => {
  if (!plan || typeof plan !== 'object') return 'entry is not an object';
  const p = plan as Record<string, unknown>;
  if (typeof p.id !== 'string' || !p.id) return 'missing id';
  if (typeof p.displayName !== 'string' || !p.displayName) return `plan ${p.id}: missing displayName`;
  if (typeof p.tier !== 'number' || !Number.isFinite(p.tier)) return `plan ${p.id}: missing tier`;
  if (typeof p.sharedCredits !== 'number' || !Number.isFinite(p.sharedCredits)) {
    return `plan ${p.id}: missing sharedCredits`;
  }
  if (typeof p.creditPeriod !== 'string' || !CREDIT_PERIODS.has(p.creditPeriod)) {
    return `plan ${p.id}: creditPeriod must be one of ${[...CREDIT_PERIODS].join(' / ')}, got ${JSON.stringify(
      p.creditPeriod
    )}`;
  }
  if (typeof p.priceUsd !== 'number' || !Number.isFinite(p.priceUsd)) return `plan ${p.id}: missing priceUsd`;
  return null;
};

/**
 * Fetch plan metadata from the gateway. Never falls back to bundled data —
 * see the module docstring.
 */
export async function fetchPlans(locals?: App.Locals): Promise<PlansResult> {
  const gatewayUrl = getEnv('GATEWAY_API_URL', locals);
  if (!gatewayUrl) {
    return fail('missing_gateway_url', 'GATEWAY_API_URL is not configured for this deployment');
  }

  const endpoint = `${gatewayUrl.replace(/\/+$/, '')}/api/plans`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    return fail('network_error', `${endpoint} unreachable: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!res.ok) {
    return fail('http_error', `${endpoint} returned HTTP ${res.status}`);
  }

  let body: PlansApiResponse;
  try {
    body = (await res.json()) as PlansApiResponse;
  } catch (err) {
    return fail(
      'malformed_body',
      `${endpoint} returned invalid JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!body || !Array.isArray(body.plans) || body.plans.length === 0) {
    return fail('malformed_body', `${endpoint} returned no plans array`);
  }
  if (typeof body.version !== 'number' || typeof body.trialDays !== 'number') {
    return fail('malformed_body', `${endpoint} returned no version / trialDays`);
  }

  for (const plan of body.plans) {
    const problem = describeInvalidPlan(plan);
    if (problem) return fail('invalid_plan', problem);
  }

  const plans = body.plans as PlanFromApi[];

  // A plan we have no localized copy for cannot be rendered, and silently
  // dropping it would hide a whole tier from the pricing page. Fail loudly so
  // the missing copy gets noticed and shipped.
  const unknown = plans.find((p) => !KNOWN_PLAN_IDS.has(p.id));
  if (unknown) {
    return fail('unknown_plan_id', `plan "${unknown.id}" has no localized copy in src/data/plan-features.ts`);
  }

  if (!plans.some((p) => p.id === 'free')) {
    return fail('free_plan_missing', 'payload has no free plan');
  }

  return {
    ok: true,
    data: {
      version: body.version,
      trialDays: body.trialDays,
      plans: [...plans].sort((a, b) => a.tier - b.tier),
    },
  };
}

/**
 * Build a `{ planId: stripePriceId }` map, skipping plans without a
 * configured Stripe price (e.g. free tier).
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
