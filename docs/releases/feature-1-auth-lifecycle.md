# Feature 1 Auth Lifecycle Release Gate

Feature 1 includes the Shopify auth/session foundation, app lifecycle webhook foundation, and authenticated admin shell. It does not include product search, video upload, video processing, video library, product tagging, widgets, storefront rendering, analytics, or social import integrations.

## Runtime Verdict

Feature 1 now has a Vercel server runtime path for Shopify auth, admin dashboard data, and lifecycle webhooks.

The deployment uses two Vercel outputs:

- Static client output from `apps/shopify-app/dist/client`.
- Node serverless runtime through `api/[...path].ts`, delegated to `apps/shopify-app/server/vercel-runtime.ts`.

## Current Route Coverage

| Route or flow | Current code exists | Deployed by current Vercel config | Current verdict |
| --- | --- | --- | --- |
| `/` admin shell | Yes | Yes, static Vite output | Available, but backend context may fall back to safe error |
| `/api/admin/dashboard` | Yes | Yes, serverless runtime | Available for authenticated admin dashboard data |
| `/webhooks` | Yes | Yes, rewritten to `/api/webhooks` serverless runtime | Available for raw-body Shopify webhook handling |
| `/auth/*` and Shopify callback/session routes | Yes | Yes, rewritten to `/api/auth/*` serverless runtime | Available for Shopify admin auth helper |

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
- Vercel runtime route surface for auth, health, dashboard data, and webhooks.
- E2E frontend shell fallback when backend context is unavailable.
- E2E frontend rendering when admin dashboard data is mocked as available.

These tests do not prove a real Vercel deployment can receive Shopify callbacks or webhooks from a Shopify development store. That must be proven through the Feature 1 manual QA checklist.

## Branch Note

GitHub currently uses `main` as the default branch. The active branch model is:

- `main` for integration.
- `backend` for backend lane work.
- `frontend` for frontend lane work.
- `prod` for production.
- `dev` as a legacy branch that should not receive new PRs.

Production promotion should flow from `main` to `prod` only when release-ready.

## Release Decision

Feature 1 should not be marked production-ready until:

- The Feature 1 manual QA checklist passes against a Vercel preview.
- Shopify install/auth works from the configured Vercel URL.
- `app/uninstalled` is delivered to Vercel and updates `Shop.uninstalledAt`.
- Reinstall clears `Shop.uninstalledAt` or otherwise reactivates the shop.
- CI and local regression checks remain green.
