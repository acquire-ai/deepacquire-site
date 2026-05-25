# 支持取消订阅功能

我们已经上线了订阅功能。 详见 @src/pages/pricing.astro 页面。

但是在管理页面@src/pages/account.astro 看不到取消订阅和Adjust plan
或者 Update your payment details

## 技术背景

1. 我们是基于<http://stripe.com/> 的
2. 后端网关项目在：@/Users/leixin/CodeSrc/gateway-worker

---

## 设计方案（待 review）

### 1. 现状梳理

**前端 `deepacquire-site`**

- `src/pages/account.astro`：只展示头像 / 显示名 / 邮箱 / sub，以及一个 Sign out 按钮，没有任何订阅相关 UI。
- `src/pages/pricing.astro` + `src/pages/checkout/[plan].ts`：负责"购买/升级"流程，已经能跳转到 Stripe Checkout。
- `src/pages/checkout/success.astro` / `cancel.astro`：Checkout 完成 / 取消跳回页。

**后端 `gateway-worker`**（已实现，无需改动）

- `GET /api/subscription/status` → `{ plan, status, currentPeriodEnd, cancelAtPeriodEnd }`（见 `src/routes/subscription.ts`）。
- `POST /api/billing/portal` → 调用 `stripe.billingPortal.sessions.create`，返回 `{ url }`，是 **Stripe 官方托管的 Customer Portal**，自带：
  - 取消订阅（Cancel subscription）
  - 调整套餐（Switch / Adjust plan）
  - 更新付款方式（Update payment method）
  - 查看 / 下载发票
- Webhook `customer.subscription.updated/deleted` 已能把取消、降级、周期变化同步回 D1，前端不用再处理状态。

**结论**：后端能力齐全，需求本质是 **把 `/api/subscription/status` 和 `/api/billing/portal` 接到 `account.astro` 上**。

### 2. 推荐方案：复用 Stripe Customer Portal

不自建"取消 / 改套餐 / 改卡"UI，理由：

1. 后端 `/api/billing/portal` 已经写好。
2. Stripe Portal 是 PCI / SCA / 退款流程合规的官方实现，省掉一大堆 edge case（prorate、试用、税、未支付发票等）。
3. issue 里点名的三个功能（Cancel、Adjust plan、Update payment details）恰好是 Portal 默认覆盖的三件套。
4. 后续 Ultra plan、年付、coupon 上线时无需改前端。

### 3. 前端改动清单

#### 3.1 新增路由 `src/pages/account/billing-portal.ts`（GET）

服务端代理路由，避免把 session token 暴露给浏览器 fetch：

1. 从 cookie 读 `da_id_token`，未登录 → 302 到 `/auth/sign-in?returnTo=/account`。
2. `POST {GATEWAY_API_URL}/api/billing/portal`，body `{ returnUrl: ${origin}/account }`，带 `Authorization: Bearer ${sessionToken}`。
3. 成功 → `302` 到 `data.url`。
4. 失败分支：
   - `404`（用户从没付费过）→ `302` 回 `/pricing`，并 flash 提示"你还没有订阅"（用 query string 传，例如 `/pricing?msg=no_subscription`）。
   - 其它 5xx → 返回纯文本 502，文案"Unable to open billing portal. Please try again."。
   - `GATEWAY_API_URL` 缺失 → 500（沿用 `checkout/[plan].ts` 已有的错误风格）。

> 实现风格直接抄 `src/pages/checkout/[plan].ts`，保证 env 读取、错误处理一致。

#### 3.2 改造 `src/pages/account.astro`

在现有 "Signed in as" 卡片下面新增一张 **"Subscription"** 卡片：

服务端：

```ts
// 已有 verifySession 后
const gatewayUrl = getEnvValue('GATEWAY_API_URL', Astro.locals);
let sub: { plan: string; status: string; currentPeriodEnd: number | null; cancelAtPeriodEnd: boolean } | null = null;
if (gatewayUrl) {
  try {
    const res = await fetch(`${gatewayUrl.replace(/\/+$/g, '')}/api/subscription/status`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) sub = await res.json();
  } catch {
    /* 静默降级为 free */
  }
}
const planId = sub?.plan ?? 'free';
const isPaid = planId !== 'free';
```

UI（参考 pricing 页样式，沿用 PLAN_CONTENT 的 displayName 当标题）：

- 顶行：套餐名 + 状态徽章（active / past_due / canceled）。
- 第二行（仅付费用户）：
  - `cancelAtPeriodEnd === true` → "Ends on <YYYY-MM-DD>"（红/橙色提示）。
  - 否则 → "Renews on <YYYY-MM-DD>"。
- 按钮区：
  - **付费用户**：主按钮 "Manage subscription" → `/account/billing-portal`。下面用一行小字解释"Use the Stripe portal to cancel, change plan, or update your payment method."。
  - **免费用户**：主按钮 "Upgrade plan" → `/pricing`。

> 注意：`Manage subscription` 用 `<a>` 直接跳到代理路由就行，不需要 JS。保留 `Cache-Control: private, no-store` 防止 CDN 缓存订阅状态。

#### 3.3 文案与 i18n

- 第一版只动英文 `src/pages/account.astro`；如果存在 `zh-CN` / `zh-TW` 对应的 account 页（待 grep 确认），同步加上。后续 PLAN_CONTENT 风格已有 i18n 框架，可以接入。

### 4. 后端 / Stripe 侧配置（一次性）

这是方案能跑起来的前提，**需要你在 Stripe Dashboard 操作一次**：

1. Test mode 和 Live mode 各做一遍：
   `Dashboard → Settings → Billing → Customer portal`
2. 启用以下功能：
   - **Cancel subscriptions** —— 推荐选 "at end of billing period"，与现有 webhook 行为（`cancel_at_period_end` 同步、周期末降回 free）一致。
   - **Update payment methods** —— 默认开。
   - **Switch plans** —— 把 `pro` (`price_1TGyhECLGbk1ApqBZFw604u8`) 和 `max` (`price_1TGymSCLGbk1ApqBY17xslva`) 都加进可切换列表；勾选 "Prorate when changing prices"。Ultra 还没 priceId，先不加。
   - **Invoice history** —— 默认开。
3. 配置 portal 的 "Default redirect link" / business info / TOS / Privacy 链接，保证回跳一致体验。

> 我会把这一步写成 checklist 放到 PR 描述里，方便部署时核对。

### 5. 不在本次范围内的事

- 不自建取消 / 改套餐 / 改卡 UI。
- 不改 webhook、不改 D1 schema、不改 plans 数据。
- 不实现"立即取消并退款"流程；用户想立即停用走 portal 自己点。
- 不动 pricing 页（购买流程已 ok）。

### 6. 验证计划（review 通过后我会按这个跑）

1. **未登录**访问 `/account/billing-portal` → 302 到 `/auth/sign-in?returnTo=/account`。
2. **免费用户**访问 `/account`：看到 "Free" 卡片 + "Upgrade plan" 按钮；访问 `/account/billing-portal` → 302 回 `/pricing?msg=no_subscription`。
3. **付费 Pro 用户**（test mode 完整跑一遍 checkout）：
   - `/account` 看到 "Pro" + "Renews on …" + "Manage subscription"。
   - 点击 → 进入 Stripe portal，能看到 Cancel / Switch plan / Update payment method。
   - portal 里点 "Cancel subscription"（at period end）→ 回到 `/account`，刷新后看到 "Ends on …" 文案。webhook 把 `cancel_at_period_end=1` 写回 D1。
   - portal 里把 Pro 换成 Max → 回到 `/account`，看到 "Max" + 新周期；webhook 同步。
4. **故障演练**：临时把 `GATEWAY_API_URL` 改成不可达 → `/account` 仍能渲染（订阅卡片降级显示为 "Free"，不爆 500）。
5. `pnpm lint` / `pnpm test`（如有 vitest 覆盖订阅相关单测则补一下）通过。

### 7. 风险 / 注意点

- **Stripe Portal 未启用 cancel/switch 功能时**，按钮虽然能跳但用户进去看不到选项 —— 必须先做"第 4 节"配置。
- `GET /api/subscription/status` 返回的 `currentPeriodEnd` 是 epoch 秒，渲染时记得 `* 1000`。
- `account.astro` 走 SSR，注意 `prerender = false`、`Cache-Control: private, no-store` 已经在了，**新加的 billing-portal 路由也必须** `prerender = false` 并设 `Cache-Control: no-store`。
- Cloudflare Pages adapter：用 `Astro.locals.runtime.env` 取 `GATEWAY_API_URL`，照搬 `getEnvValue` 即可。

---

请 review 以上方案。如果 OK，我会按下面顺序开工：

1. 新增 `src/pages/account/billing-portal.ts`。
2. 改造 `src/pages/account.astro` 增加订阅卡片。
3. 写一份 PR 描述，包含第 4 节的 Stripe Dashboard checklist。
4. 跑 lint / test，自测 4 个场景。
