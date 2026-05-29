# Project Handoff For New Laptop

Last updated: 2026-05-29

This file is intended for a future Codex session on a new machine. It contains operational project context, but it intentionally does not contain secrets, tokens, database URLs, bearer tokens, or `.env` contents.

## Golden Rules

- Read `.tips/*.md` before touching deployment, auth, Shopify config, Vercel config, or Supabase config.
- Do not commit `.tips`, `.env*`, `.vercel`, logs, screenshots, `dist`, build output, or generated artifacts.
- Do not print secrets or tokens.
- Do not run destructive database commands.
- Do not use random Vercel deployment URLs as the Shopify app URL.
- Do not use the old `dev` branch.
- Do not create a new Shopify app unless explicitly requested.
- Do not deploy production unless explicitly requested.

## Current Important Correction

Some local `.tips` files still mention the older stable QA URL:

```text
https://shopify-tool-git-main-rajat-sahadev-s-projects.vercel.app
```

The active recovery project currently used for QA is:

```text
https://shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app
```

The correct Vercel project for current preview work is `shopify-tool-live`.

Do not deploy the typo project `shoify-tool`. The local folder is named `shoify-tool`, but the Vercel project is not.

## Repository

- GitHub repo: `Rajat-Singh02/shopify-tool`
- GitHub URL: `https://github.com/Rajat-Singh02/shopify-tool`
- Default branch: `main`
- Repo visibility at last check: public
- Local path on old laptop: `/Users/rsahadev/Documents/shoify-tool`
- Active GitHub CLI account at last check: `rsahadev02`
- Repo owner/user in remote URL: `Rajat-Singh02`
- Usual reviewer: `ams-allin`

Remote:

```sh
git remote -v
# origin https://github.com/Rajat-Singh02/shopify-tool.git
```

## Recently Merged PR Stack

At the time this file was updated:

- PR #71: `feat(admin): revamp widget workflow with app embed`
  - URL: `https://github.com/Rajat-Singh02/shopify-tool/pull/71`
  - base: `main`
  - head: `feature/admin-ux-revamp-app-embed`
  - status: merged
  - merged at: `2026-05-29T14:42:58Z`
- PR #72: `feat(onboarding): add setup wizard`
  - URL: `https://github.com/Rajat-Singh02/shopify-tool/pull/72`
  - base: `feature/admin-ux-revamp-app-embed`
  - head: `feature/setup-wizard-onboarding`
  - status: merged
  - merged at: `2026-05-29T14:43:35Z`

The admin UX revamp, app embed foundation, and setup wizard are now expected to be on `main`.

Next action after cloning on the new laptop is to pull latest `main`, then deploy latest `main` to the correct Vercel project `shopify-tool-live` if that has not already been done.

Deployment automation added after this handoff was first created:

- `.github/workflows/deploy-preview.yml` deploys the stable Preview after `CI` succeeds on `main`.
- `scripts/deploy-preview.sh` is the reusable deployment script.
- `npm run deploy:preview` is the manual fallback command.
- `docs/deployment/stable-preview-deploy.md` documents the required GitHub secrets and QA checks.
- The deploy script validates Shopify TOML files every run and detects Shopify TOML/theme extension changes before aliasing Vercel.
- If TOML or `extensions/` changed, run `npx shopify app deploy --config shopify.app.antiquinn.toml`, then run `SHOPIFY_CONFIG_DEPLOYED=true npm run deploy:preview`.

Current local branch when this file was created:

```text
feature/setup-wizard-onboarding
```

Current local commit when this file was created:

```text
46099f4 feat(onboarding): add setup wizard
```

## Branch And PR Workflow

- `main`: default integration branch.
- `prod`: production release branch.
- `backend` / `frontend`: only use if explicitly asked or lane-specific.
- `dev`: legacy only. Do not use.
- Feature branches usually use `feature/<name>`.
- Fix branches usually use `fix/<name>`.
- Keep PRs small and focused.
- Add reviewer `ams-allin`.
- Report PR URL, branch, target branch, files changed, tests run, risks, and next action.

## New Laptop Bootstrap

Recommended baseline:

- Node.js 22 or newer.
- npm.
- GitHub CLI authenticated.
- Vercel CLI authenticated.
- Shopify CLI authenticated if deploying Shopify config or extensions.
- Prisma CLI comes from package dev dependencies.
- Playwright browser dependencies installed before E2E.

Clone and install:

```sh
git clone https://github.com/Rajat-Singh02/shopify-tool.git shoify-tool
cd shoify-tool
npm ci
npx playwright install --with-deps chromium
npm run db:generate
```

Use merged latest for normal work:

```sh
git fetch origin --prune
git checkout main
git pull --ff-only origin main
```

Create a local `.env` from `.env.example` and fill values locally only:

```sh
cp .env.example .env
```

Never commit `.env`.

## Validation Commands

Primary validation set:

```sh
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run db:generate
npm run build
npm run vercel:build
npx vercel build
npm run test:e2e
```

Notes:

- Do not run `npx vercel build` in parallel with `npm run test:e2e`. `npx vercel build` can run `npm ci`, which can disturb the Playwright dev server.
- `npx vercel build` may warn that it is not running on Vercel. That warning is normal for local builds.
- The `engines` warning about Node `>=22.0.0` is not currently a blocker.

## Repo Layout

Important top-level files:

- `package.json`: workspace scripts and dependencies.
- `vercel.json`: Vercel build and rewrite configuration.
- `shopify.app.antiquinn.toml`: active Shopify CLI config for the ANTIQUINN app.
- `shopify.app.toml`: alternate Shopify config with the Shoppable Video display name.
- `prisma.config.ts`: Prisma config.
- `vitest.config.ts`: unit/integration test config.
- `playwright.config.ts`: E2E config.
- `.github/workflows/ci.yml`: GitHub Actions CI.

Workspaces:

- `apps/shopify-app`: embedded admin frontend and app services.
- `packages/db`: Prisma client helpers, repositories, Shopify session storage.
- `packages/shopify`: Shopify product/webhook helpers.
- `packages/shared`: shared DTO/types/utilities.
- `packages/testing`: testing helpers.
- `packages/widget`: storefront widget package.
- `workers/video`: video processing worker foundation.

Server/runtime areas:

- `api/[...path].ts`: main Vercel catch-all runtime dispatcher.
- `api/admin/[...path].ts`: admin API catch-all function.
- `api/auth/[...path].ts`: auth callback function.
- `api/storefront/[...path].ts`: storefront API catch-all function.
- `api/widget.ts`: public widget script function.
- `server/api/*`: API implementation modules.

Admin frontend pages:

- `apps/shopify-app/routes/DashboardPage.tsx`
- `apps/shopify-app/routes/VideosPage.tsx`
- `apps/shopify-app/routes/VideoDetailPage.tsx`
- `apps/shopify-app/routes/WidgetsPage.tsx`
- `apps/shopify-app/routes/ProductsPage.tsx` still exists but product search is expected to become an internal picker, not primary merchant value.

Shopify theme extension:

- `extensions/shoppable-video-block/shopify.extension.toml`
- `extensions/shoppable-video-block/blocks/shoppable-video-app-embed.liquid`
- `extensions/shoppable-video-block/blocks/shoppable-video-widget.liquid`
- `extensions/shoppable-video-block/README.md`

## Vercel

Correct current Vercel project:

```text
shopify-tool-live
```

Local `.vercel/project.json` at last check:

```text
projectName: shopify-tool-live
projectId: prj_shS8onETrfkn7ggh0Rk8sQh4Dvu8
orgId: team_jl9XT0KmvACaJPnjgM8pcoz0
framework: vite
installCommand: npm ci --include=dev
buildCommand: npm run vercel:build
outputDirectory: apps/shopify-app/dist/client
nodeVersion: 24.x
```

Do not use:

- `shoify-tool`: typo/duplicate project.
- `shopify-tool`: older project that previously had deployment/routing issues. Use only if explicitly reverting.

Current active stable QA URL:

```text
https://shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app
```

At last verification:

- Stable alias points to a Ready preview deployment.
- `/health` returns HTTP 200.
- `/api/admin/dashboard` returns safe HTTP 410 by direct curl without bearer auth.
- Root HTML contains:
  - `<meta name="shopify-api-key" content="507ec4018317a9c292eed04878307f58" />`
  - Shopify App Bridge script.

Current Vercel function shape from inspect:

- `api/[...path]`
- `api/admin/[...path]`
- `api/auth/[...path]`
- `api/storefront/[...path]`
- `api/widget`

Important Hobby plan constraint:

- Vercel Hobby has a serverless function count limit.
- Keep the catch-all routing shape. Avoid adding many standalone Vercel functions.
- `vercel.json` rewrites route admin/storefront paths into catch-all functions.

Required Preview environment variable names on `shopify-tool-live`:

- `APP_URL`
- `SHOPIFY_APP_URL`
- `PUBLIC_MEDIA_BASE_URL`
- `PLAYWRIGHT_BASE_URL`
- `SHOPIFY_API_KEY`
- `SHOPIFY_CLIENT_ID`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_SCOPES`
- `SHOPIFY_API_VERSION`
- `DATABASE_URL`
- `SESSION_SECRET`
- `ENCRYPTION_KEY`
- `QUEUE_PROVIDER`
- `STORAGE_PROVIDER`
- `LOCAL_STORAGE_ROOT`
- `FFMPEG_PATH`
- `FFPROBE_PATH`
- `MAX_VIDEO_SIZE_MB`
- `ALLOWED_VIDEO_MIME_TYPES`
- `ANALYTICS_ENABLED`

Do not print values for encrypted/sensitive vars.

Vercel env gotcha:

- `vercel env pull` can produce blank local values for encrypted variables. Do not assume blank pulled values mean runtime values are missing.
- Use Vercel dashboard, `vercel env ls preview`, and runtime route checks.
- If adding Preview env vars, leave Git branch blank for all Preview branches if Vercel rejects `preview main`.

Preview deployment flow:

```sh
git checkout main
git pull --ff-only origin main
npx vercel pull --yes --environment=preview --git-branch main
rm -rf .vercel/output apps/shopify-app/dist
npx vercel build
npx vercel deploy --prebuilt --target=preview --logs
```

Only alias a Ready deployment:

```sh
READY_URL="https://replace-with-ready-preview-url.vercel.app"
npx vercel inspect "$READY_URL" --wait --timeout 120s
npx vercel alias set "$READY_URL" shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app
```

Post-alias checks:

```sh
npx vercel inspect https://shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app
curl -i https://shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app/health
curl -s https://shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app/ | grep -i "shopify-api-key\\|app-bridge"
curl -i https://shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app/api/admin/dashboard
```

Expected:

- `/health`: HTTP 200 JSON.
- Root: Shopify API key meta and App Bridge script.
- `/api/admin/dashboard` without bearer: safe HTTP 410 JSON.
- Inside Shopify Admin with bearer: HTTP 200.

## Shopify

Connected test shop:

```text
mvqamy-m1.myshopify.com
```

Admin app appears as:

- `ANTIQUINN` in some Shopify surfaces.
- `Shoppable Video` in some config/app surfaces.

Verify by Client ID, not by display label.

Public Shopify Client ID / App Bridge API key:

```text
507ec4018317a9c292eed04878307f58
```

Active config:

```text
shopify.app.antiquinn.toml
```

Current tracked Shopify app URL:

```text
https://shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app
```

Current redirect URL:

```text
https://shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app/auth/callback
```

Current webhook URI:

```text
/webhooks
```

Current scope:

```text
read_products
```

Shopify config deploy:

```sh
npx shopify app deploy --config shopify.app.antiquinn.toml
```

If Shopify CLI asks to create a new app, say no.

Token/auth checks:

- App Bridge ID token `aud` must equal `507ec4018317a9c292eed04878307f58`.
- `dest` should be `https://mvqamy-m1.myshopify.com`.
- Admin API calls from the embedded app must include `Authorization: Bearer ...`.
- Never paste bearer tokens or ID tokens into chat or logs.

Manual Shopify QA:

1. Open Shopify Admin.
2. Apps -> ANTIQUINN / Shoppable Video.
3. Verify iframe/request URL uses `shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app`.
4. Verify dashboard loads the connected shop.
5. Verify `/api/admin/dashboard` has Authorization bearer header in browser devtools.
6. Verify Products/Videos/Widgets/Dashboard routes refresh to app HTML, not Vercel 404.
7. Verify app embed/app block is available after Shopify CLI deploy.

## Shopify Theme Extension / Storefront Install

PR #71 adds a Shopify theme extension for smoother storefront install.

Blocks:

- App embed: `shoppable-video-app-embed.liquid`
  - Enable once in theme editor.
  - Accepts one or more widget IDs.
  - Multiple widget IDs are comma-separated.
- App block: `shoppable-video-widget.liquid`
  - Adds one widget in a specific section.

Current storefront script still exists:

```html
<script
  src="https://shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app/widget.js"
  data-shop="mvqamy-m1.myshopify.com"
  data-widget-id="widget-id"
></script>
```

Long-term preferred install path:

1. Merchant enables the app embed once.
2. Merchant pastes comma-separated published widget IDs.
3. Multiple widgets render without stacking raw Custom Liquid snippets.

## Supabase / Database

Prisma schema:

```text
packages/db/prisma/schema.prisma
```

Migrations:

- `20260522111500_init_with_shopify_sessions`
- `20260526000000_add_video_storage_objects`
- `20260526010000_add_video_product_tag_handle`

Main tables:

- `Shop`
- `ShopifySession`
- `WebhookDelivery`
- `Video`
- `VideoStorageObject`
- `VideoProductTag`
- `Widget`
- `WidgetVideo`
- `AnalyticsEvent`
- `_prisma_migrations`

Supabase URL rules:

- Migrations use session pooler:
  - port `5432`
  - `schema=public`
- Vercel runtime uses transaction pooler:
  - port `6543`
  - `pgbouncer=true`
  - `connection_limit=1`
  - `schema=public`

Migration command pattern:

```sh
DATABASE_URL="$SUPABASE_SESSION_DATABASE_URL" npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
npm run db:generate
```

Do not run:

```sh
prisma migrate reset
```

Useful verification SQL:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

```sql
select
  "shopDomain",
  "installedAt",
  "uninstalledAt",
  "createdAt",
  "updatedAt"
from "Shop"
order by "updatedAt" desc;
```

Do not query or paste `accessToken` unless absolutely required.

## Storage And Video Media

Current intended preview behavior:

- Use `STORAGE_PROVIDER=database` for Vercel preview.
- Database-backed preview media is stored in `VideoStorageObject`.
- The storefront media route streams video bytes from the database.
- This is acceptable for QA-sized videos.
- Production-scale media should move to object storage/CDN such as R2 or S3.

Old issue:

- When `STORAGE_PROVIDER=local` was used on Vercel, uploaded videos could become `READY` but fail playback because the temporary function filesystem disappeared.
- Re-upload videos after switching preview storage to database.

Media endpoints:

- Public widget payload includes `publicUrl` only when safe media is available.
- Public media route supports range requests for browser playback.
- Storefront payload must never expose filesystem paths, storage keys, tokens, or secrets.

## Current Product Scope

Implemented or in active PR stack:

- Embedded Shopify admin shell.
- App Bridge auth with bearer token injection.
- Shop lifecycle app/uninstalled webhook handling.
- Product and variant search through Shopify Admin API.
- Manual video upload.
- Video processing/metadata foundation.
- Video retry processing.
- Durable preview video storage through database provider.
- Video library and video detail pages.
- Variant-level product tagging.
- Widget creation and management.
- READY-only widget attach validation.
- Storefront widget rendering.
- Product CTA on reel cards.
- Mute/unmute UX with only one unmuted video at a time.
- Public storefront event ingestion.
- Admin analytics summary/events APIs.
- Admin UX revamp and Shopify app embed/app block foundation in PR #71.
- Dashboard setup wizard in PR #72.

Out of scope unless explicitly requested:

- Instagram import.
- TikTok import.
- Facebook/Meta integrations.
- External analytics vendors.
- Cookies/fingerprinting/PII collection.
- Advanced attribution.
- Theme extension production release automation beyond Shopify CLI deploy.
- Production CDN/object storage migration.
- Full analytics charts dashboard.
- Advanced widget template editor.

## Admin UX Direction

The approved direction is to simplify around one merchant path:

```text
upload video -> tag product -> create/publish widget -> add to storefront
```

Navigation direction:

- Dashboard/Home should show setup progress, widget grid, recent videos, and simple analytics.
- Products should not be a primary merchant destination long-term; product search is useful inside tagging.
- Videos should act as the video library.
- Video detail should be a dedicated route, not inline expansion.
- Widgets should use cards and dedicated detail routes, not a bottom-of-page details panel.
- Widget status should use clear actions like Publish, Unpublish, Archive instead of a confusing dropdown.
- Installation should prefer app embed/app block guidance instead of raw code-first Custom Liquid.

## Storefront Widget UX Direction

Current desired storefront behavior:

- Carousel-style horizontal reel cards.
- Compact embed footprint so multiple widgets do not take over the page.
- Autoplay loop.
- Muted by default.
- Only one reel on the page can be unmuted at a time.
- Product CTA opens the tagged product page.
- Avoid native video controls unless needed as an accessibility fallback.
- Do not show generic headings like `shirt` above widgets.

## API Surface

Important admin routes:

- `GET /api/admin/dashboard`
- `GET /api/admin/products/search`
- `GET /api/admin/videos`
- `GET /api/admin/videos/:videoId`
- `POST /api/admin/videos/upload-intent`
- `PUT /api/admin/videos/:videoId/upload`
- `POST /api/admin/videos/:videoId/complete-upload`
- `POST /api/admin/videos/:videoId/retry-processing`
- `POST /api/admin/videos/:videoId/archive`
- `GET /api/admin/videos/:videoId/product-tags`
- `POST /api/admin/videos/:videoId/product-tags`
- `DELETE /api/admin/videos/:videoId/product-tags/:tagId`
- `GET /api/admin/widgets`
- `POST /api/admin/widgets`
- `GET /api/admin/widgets/:widgetId`
- `PATCH /api/admin/widgets/:widgetId`
- `POST /api/admin/widgets/:widgetId/videos`
- `DELETE /api/admin/widgets/:widgetId/videos/:videoId`
- `GET /api/admin/analytics/summary`
- `GET /api/admin/analytics/events`

Important public routes:

- `GET /health`
- `GET /widget.js`
- `GET /api/storefront/widgets/:widgetId?shop=<shop>.myshopify.com`
- `GET /api/storefront/widgets/:widgetId/videos/:videoId/media?shop=<shop>.myshopify.com`
- `POST /api/storefront/events`
- `/auth/*`
- `/webhooks`

Admin routes require embedded Shopify admin auth. Public storefront routes must not require admin bearer tokens.

## Privacy And Safety Rules

- No raw IP storage.
- No cookies for analytics.
- No fingerprinting.
- No PII collection.
- No external analytics vendors.
- Do not expose:
  - Shopify access tokens
  - App Bridge ID tokens
  - bearer tokens
  - Shopify API secret
  - `DATABASE_URL`
  - session secret
  - encryption key
  - raw request headers
  - filesystem paths
  - local storage root
  - private storage keys

## Known Troubleshooting

If Shopify Admin shows Example Domain:

- Shopify app config likely points to placeholder/stale URL.
- Check `shopify.app.antiquinn.toml`.
- Check Shopify Partner Dashboard app URL.

If `/api/admin/dashboard` is 410 by curl:

- Expected without bearer token.

If `/api/admin/dashboard` is 410 inside Shopify Admin:

- Check App Bridge token `aud` against Client ID.
- Check `SHOPIFY_API_SECRET`.
- Check `SHOPIFY_API_KEY`.
- Check app URL and redirect URL.

If admin API has Authorization header but returns 500:

- Suspect Prisma/database/runtime env.
- Check Vercel `DATABASE_URL` first.

If product search returns 410:

- Reinstall/reconnect app from Shopify admin if offline token/session is stale.
- Verify the app has `read_products`.

If product tags return 500:

- Confirm latest migrations are deployed.
- Confirm `VideoProductTag.productHandleSnapshot` migration exists.

If video shows READY but storefront says preview unavailable:

- Confirm `STORAGE_PROVIDER=database` in Vercel Preview.
- Confirm the video was uploaded after the storage switch.
- Confirm media endpoint returns HTTP 200 or 206 with `Content-Type: video/mp4`.
- Re-upload the video if it was uploaded while local storage was active.

If Vercel deploy creates UNKNOWN deployments:

- Do not alias UNKNOWN deployments.
- Inspect the project link and project name.
- Correct project is `shopify-tool-live`.

If Vercel says too many serverless functions:

- Keep using catch-all routes.
- Do not add many individual function files.

If direct route refresh gives Vercel 404:

- Check `vercel.json` SPA rewrites for `/products`, `/videos`, and `/widgets`.

## Useful Commands

Git/GitHub:

```sh
git status --short
git branch --show-current
git remote -v
gh auth status
gh pr list --state open --limit 20
gh pr view 71 --json state,baseRefName,headRefName,url,title,statusCheckRollup
gh pr view 72 --json state,baseRefName,headRefName,url,title,statusCheckRollup
```

Vercel:

```sh
npx vercel whoami
cat .vercel/project.json
npx vercel env ls preview
npx vercel inspect https://shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app
npx vercel logs <actual-deployment-url> --since 15m
```

Route checks:

```sh
curl -i https://shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app/health
curl -s https://shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app/ | grep -i "shopify-api-key\\|app-bridge"
curl -i https://shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app/api/admin/dashboard
curl -i https://shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app/api/admin/videos
curl -i https://shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app/api/admin/widgets
```

Storefront widget payload check:

```sh
curl -s "https://shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app/api/storefront/widgets/<WIDGET_ID>?shop=mvqamy-m1.myshopify.com" | jq
```

Media route check:

```sh
curl -I "https://shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app/api/storefront/widgets/<WIDGET_ID>/videos/<VIDEO_ID>/media?shop=mvqamy-m1.myshopify.com"
```

Safety scans:

```sh
rg -n "SHOPIFY_API_SECRET|DATABASE_URL|SESSION_SECRET|ENCRYPTION_KEY|S3_SECRET|ACCESS_TOKEN|PRIVATE_KEY|Authorization|Bearer|Cookie|Set-Cookie" . -g '!node_modules/**' -g '!dist/**' -g '!build/**' -g '!.git/**' -g '!.env' -g '!.env.*' -g '!.vercel/**' -g '!.tips/**'
rg -n "ngrok|instagram|tiktok|facebook|meta|google-analytics|gtag|segment|mixpanel|amplitude" . -g '!node_modules/**' -g '!dist/**' -g '!build/**' -g '!.git/**' -g '!.tips/**'
```

## Files To Read First On New Laptop

1. `.tips/README.md`
2. `.tips/codex-rules.md`
3. `.tips/current-working-setup.md`
4. `.tips/vercel.md`
5. `.tips/shopify.md`
6. `.tips/supabase.md`
7. `.tips/troubleshooting.md`
8. `docs/project-handoff-new-laptop.md`
9. `vercel.json`
10. `shopify.app.antiquinn.toml`
11. `packages/db/prisma/schema.prisma`
12. `extensions/shoppable-video-block/README.md`

Remember that `.tips` may lag the newer `shopify-tool-live` recovery project. Treat this handoff file and tracked config files as the newer source of truth for the live recovery project.
