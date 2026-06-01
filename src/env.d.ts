// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="vite/client" />
/// <reference types="../vendor/integration/types.d.ts" />

type Env = {
  DOWNLOAD_BUCKET?: import('@cloudflare/workers-types').R2Bucket;
  R2_PUBLIC_URL?: string;
  LOGTO_ISSUER?: string;
  LOGTO_JWKS_URI?: string;
  LOGTO_APP_ID?: string;
  LOGTO_APP_SECRET?: string;
  LOGTO_SCOPES?: string;
  GATEWAY_API_URL?: string;
  // Shared secret presented to gateway-worker when calling /api/auth/redeem-handoff.
  // Must equal the worker's SITE_REDEEM_SECRET.
  SITE_REDEEM_SECRET?: string;
  // HMAC secret used by gateway-worker to sign HS256 site session JWTs.
  // Used here ONLY to verify cookies locally (no network round-trip per request).
  // Must equal the worker's GATEWAY_SHARED_SECRET.
  GATEWAY_SHARED_SECRET?: string;
};

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Astro expects `App.Locals` to be an interface for declaration merging.
  interface Locals extends Runtime {}
}
