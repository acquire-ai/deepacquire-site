# SSO bridge: `/auth/sso`

The `/auth/sso` endpoint lets the browser extension hand off an authenticated
session to this website without forcing the user through Logto a second time.

## Flow at a glance

1. Extension finishes its own auth (PR-1, deployed in `gateway-worker`) and
   asks gateway-worker to mint a one-time **handoff token** (UUID, short TTL,
   one-time use).
2. Extension opens `https://<site>/auth/sso?token=<handoff>&returnTo=<path>` in
   a new tab.
3. This site's `/auth/sso` endpoint (server-side, `prerender = false`):
   - Validates `token` (non-empty) and `returnTo` (must be a same-origin path).
   - POSTs `{ token }` to `${GATEWAY_API_URL}/api/auth/redeem-handoff`, with
     `X-Site-Secret: ${SITE_REDEEM_SECRET}`.
   - On success, sets the existing `da_id_token` cookie to the returned
     **HS256 site session JWT** and redirects 302 to `returnTo`.
4. From then on, every page that reads `da_id_token` (e.g. `/account`,
   `/checkout/[plan]`) keeps working — see below.

## Cookie shape

The website session cookie is a single HttpOnly cookie:

- Name: `da_id_token` (the existing `LOGTO_COOKIES.idToken`; intentionally not
  renamed so deploying PR-2 does not log existing users out).
- Value: either a Logto-issued RS256 id_token (legacy, from
  `/auth/callback`) **or** a gateway-signed HS256 site session JWT (new, from
  `/auth/sso`).
- Attributes: `HttpOnly`, `Secure` (when HTTPS), `SameSite=Lax`, `Path=/`,
  `Max-Age` derived from the JWT's expiry.

`src/utils/auth/logto.ts#verifySession` decides which verification path to use
based on the JWT header `alg`:

- `HS256` → local HMAC verify with `GATEWAY_SHARED_SECRET`, plus `iss` /
  `aud` checks (`gateway-worker` / `site`).
- `RS256` (and other asymmetric algs Logto uses) → JWKS verify against the
  Logto issuer/JWKS URI.
- `none` or unknown algs → rejected.

## Required env vars

In addition to the existing `LOGTO_*` and `GATEWAY_API_URL`:

| Var                     | Purpose                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `SITE_REDEEM_SECRET`    | Sent in `X-Site-Secret` to gateway-worker. **Must equal** worker's `SITE_REDEEM_SECRET`.     |
| `GATEWAY_SHARED_SECRET` | HMAC secret used to verify HS256 site session JWTs. **Must equal** worker's identical value. |

Both are pulled from `Astro.locals.runtime.env` (Cloudflare adapter) at
request time. Local dev: add them to `.env`.

Set in production with:

```sh
# Cloudflare Pages (deepacquire-site)
wrangler pages secret put SITE_REDEEM_SECRET --project-name <pages-project>
wrangler pages secret put GATEWAY_SHARED_SECRET --project-name <pages-project>
```

## Security notes

- `/auth/sso` never logs the handoff token or the returned session JWT.
- The handoff is **single-use** and consumed by gateway-worker on the first
  redeem attempt. Reload protection on the user's tab is not required.
- `returnTo` is validated against the same allow-list as `/auth/sign-in`:
  must start with `/`, must not start with `//`, must not contain `://`.
  Anything else falls back to `/account` (matching sign-in's behavior, no
  4xx for the user).
- Gateway response codes are translated:
  - `200` → set cookie, 302 to `returnTo`.
  - `410` (handoff expired/already used) → user-facing **400** with a
    short, friendly message.
  - `401` (our `X-Site-Secret` is wrong) → user-facing **500**; this is a
    server misconfiguration, not the user's fault.
  - other non-2xx / network errors → **502**.

## Relationship to PR-1 / PR-3

- **PR-1** (`gateway-worker`, deployed): added `/api/auth/redeem-handoff`
  and made `Authorization: Bearer ...` polymorphic across Logto id_tokens
  and HS256 site session JWTs. PR-2 depends on both.
- **PR-3** (extension): will open `/auth/sso?token=...` after obtaining a
  handoff from gateway-worker.
