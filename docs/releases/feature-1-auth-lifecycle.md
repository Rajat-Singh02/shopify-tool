# Feature 1 Auth Lifecycle Release Gate

Feature 1 includes the Shopify auth/session foundation, app lifecycle webhook foundation, and authenticated admin shell. It does not include product search, video upload, video processing, video library, product tagging, widgets, storefront rendering, analytics, or social import integrations.

## Runtime Verdict

Feature 1 is not production-ready on Vercel yet.

The current `vercel.json` deploys only the static Vite client output:

```json
{
  "installCommand": "npm ci",
  "buildCommand": "npm run build",
  "outputDirectory": "apps/shopify-app/dist/client",
  "framework": "vite"
}
```

That configuration serves the frontend shell from `apps/shopify-app/dist/client`. It does not deploy a Node/server runtime for Shopify auth, admin data routes, or webhooks.

## Current Route Coverage

| Route or flow | Current code exists | Deployed by current Vercel config | Current verdict |
| --- | --- | --- | --- |
| `/` admin shell | Yes | Yes, static Vite output | Available, but backend context may fall back to safe error |
| `/api/admin/dashboard` | Handler utility exists in `apps/shopify-app/routes/app.server.ts` | No | Blocked until server runtime exists |
| `/webhooks` | Handler utility exists in `apps/shopify-app/routes/webhooks.ts` | No | Blocked until server runtime exists |
| `/auth/*` and Shopify callback/session routes | Shopify React Router auth helper exists | No concrete deployed route | Blocked until server runtime exists |

## Required Runtime Follow-Up

Create a follow-up PR:

```txt
PR 1E: fix Vercel server runtime for Shopify auth/webhooks
```

That PR should define the Vercel server runtime strategy before Feature 1 can be declared complete for deployed Shopify testing.

Minimum expected outcomes for PR 1E:

- Vercel has a Node runtime entry or framework adapter that serves Shopify auth routes.
- `/api/admin/dashboard` is routed to the authenticated admin dashboard handler.
- `/webhooks` is routed to the raw-body Shopify webhook handler.
- Raw request bodies remain available for webhook HMAC verification.
- Server code can access `DATABASE_URL`, Shopify secrets, and session storage only on the backend.
- The Vercel build output and route config are documented.
- A deployed preview can prove backend route availability, not only frontend fallback rendering.

Do not use a tunnel URL for this work.

## Automated Regression Coverage

Current automated tests cover:

- Shopify env validation.
- DB-backed Shopify session storage boundaries.
- Shop install/reinstall lifecycle behavior.
- Admin dashboard data serialization and safe error handling.
- Admin shell loading, connected shop, and safe error states.
- Valid and invalid Shopify webhook authentication.
- Webhook idempotency for duplicate deliveries.
- `app/uninstalled` lifecycle handling.
- E2E frontend shell fallback when backend context is unavailable.
- E2E frontend rendering when admin dashboard data is mocked as available.

These tests do not prove a real Vercel deployment can receive Shopify callbacks or webhooks. That must be proven after PR 1E.

## Branch Note

GitHub currently uses `main` as the default branch. The intended active model remains:

- `dev` for integration.
- `backend` for backend lane work.
- `frontend` for frontend lane work.
- `prod` for production.
- `main` as a legacy/default branch for now.

Do not merge `dev` to `main` going forward unless the branch model changes. A later repository administration task should change GitHub's default branch to `dev` after open PRs are clear.

## Release Decision

Feature 1 should not be marked production-ready until:

- PR 1E lands.
- The Feature 1 manual QA checklist passes against a Vercel preview.
- Shopify install/auth works from the configured Vercel URL.
- `app/uninstalled` is delivered to Vercel and updates `Shop.uninstalledAt`.
- Reinstall clears `Shop.uninstalledAt` or otherwise reactivates the shop.
- CI and local regression checks remain green.
