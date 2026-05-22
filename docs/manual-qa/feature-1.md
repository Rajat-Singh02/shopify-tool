# Feature 1 Manual QA Checklist

Feature 1 covers Shopify auth/session foundation, app lifecycle webhooks, and the authenticated admin shell. Product search, upload, video processing, widgets, analytics, and social integrations are out of scope.

## Current Gate

Feature 1 is not production-ready on Vercel until a server runtime is deployed for Shopify auth, admin data, and webhooks. Complete the runtime follow-up before marking this checklist passed end to end.

## 1. Vercel Setup

- Confirm the Vercel project is connected to this GitHub repository.
- Confirm Vercel Production is connected to `prod`, not `main`.
- Confirm Vercel Preview is enabled for `dev`.
- Confirm `APP_URL` and `SHOPIFY_APP_URL` match the stable Vercel URL being tested.
- Confirm `DATABASE_URL` points to the intended managed Postgres database.
- Confirm secrets are configured only in the Vercel dashboard and are not committed.
- Confirm no tunnel URL is used.

## 2. Shopify Partner Dashboard

- Confirm the app URL matches the same stable Vercel URL.
- Confirm redirect URLs match the implemented auth routes.
- Confirm scopes match `shopify.app.toml`; v1 currently requires `read_products`.
- Confirm the `app/uninstalled` webhook points to `https://<app-domain>/webhooks`.
- Confirm no tunnel URL is configured.
- Confirm no Meta, Instagram, TikTok, Facebook, or social integration scopes are configured.

## 3. Install/Auth

- Install the app on a Shopify dev store.
- Confirm the embedded app loads in Shopify admin.
- Confirm the dashboard shows the connected shop domain.
- Reload the embedded app and confirm the session persists.
- Inspect browser network responses and page source for the dashboard route and confirm no session, access token, API secret, or database URL is exposed.
- Attempt unauthenticated access to the admin data route and confirm it is rejected with a safe error.

## 4. Webhooks

- Uninstall the app from the dev store.
- Confirm Shopify delivers `app/uninstalled` to the Vercel `/webhooks` endpoint.
- Confirm the matching `Shop.uninstalledAt` value is set in Postgres.
- Replay or redeliver the same webhook and confirm duplicate delivery is safe and side effects are not repeated.
- Send an invalid-HMAC webhook request and confirm it is rejected.

## 5. Reinstall

- Reinstall the app on the same dev store.
- Confirm the existing shop is reactivated or `Shop.uninstalledAt` is cleared.
- Confirm the dashboard loads again and shows the connected shop domain.

## 6. Negative Checks

- Confirm unauthenticated admin access does not return shop data.
- Confirm invalid webhook HMAC requests are rejected.
- Confirm no social import routes, buttons, OAuth scopes, API keys, or backend fetch jobs exist.
- Confirm no tunnel URL is used in Shopify, Vercel, or repository config.

## Evidence to Capture

- Vercel deployment URL and branch.
- Shopify app ID/name used for testing.
- Dev store domain.
- Screenshot of connected shop dashboard.
- Redacted database row showing `Shop.uninstalledAt` set after uninstall.
- CI run URL.
- Local command output for lint, typecheck, unit, integration, build, and E2E.
