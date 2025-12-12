// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="vite/client" />
/// <reference types="../vendor/integration/types.d.ts" />

type Env = {
  LOGTO_ISSUER?: string;
  LOGTO_JWKS_URI?: string;
  LOGTO_APP_ID?: string;
  LOGTO_APP_SECRET?: string;
  LOGTO_SCOPES?: string;
};

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Astro expects `App.Locals` to be an interface for declaration merging.
  interface Locals extends Runtime {}
}
