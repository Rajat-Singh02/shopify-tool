# Vercel Deployment Foundation

This app deploys to Vercel. Do not use tunneling URLs for Shopify development, preview, or production setup.

The Vite client is served as static output, and Shopify backend surfaces are served by a Vercel Node serverless function.

## Project Setup

1. Create or import the GitHub repository in Vercel.
2. Set the Vercel project root to the repository root.
3. Use the existing install and build commands:

   ```sh
   npm ci --include=dev
   npm run vercel:build
   ```

4. Use `apps/shopify-app/dist/client` as the output directory.
5. Connect Vercel Production to the `prod` branch.
6. Allow Preview deployments for `main`, `backend`, `frontend`, and `feature/*` branches.

The repository includes `vercel.json` for the static client output plus serverless route rewrites. Do not add secrets or branch-specific Shopify URLs to `vercel.json`.

Vercel installs dev dependencies because TypeScript, Vite, Prisma CLI, and test type definitions are build-time dependencies in this monorepo. The Vercel build command runs Prisma client generation before package builds:

```sh
npm run db:generate && npm run build
```

The root `build` script builds workspace packages in dependency order before the Shopify app so fresh Vercel clones do not require pre-existing package `dist` output.

## Runtime Routing

The Vercel deployment uses two outputs:

- Static client bundle: `apps/shopify-app/dist/client`, produced by `npm run build`.
- Serverless runtime: `api/[...path].ts`, compiled by Vercel as a Node function.
- Nested auth runtime: `api/auth/[...path].ts`, which delegates to the same runtime so `/auth/callback` is handled by Vercel instead of falling through to static routing.

Runtime routes:

| Public path | Vercel destination | Runtime handler |
| --- | --- | --- |
| `/webhooks` | `/api/webhooks` | Shopify raw-body webhook handler |
| `/api/admin/dashboard` | `/api/admin-dashboard` | Authenticated dashboard data handler |
| `/auth/*` | `/api/auth/*` | Shopify React Router admin auth helper |
| `/health` | `/api/health` | Health handler |

`/webhooks` is rewritten so Shopify can use the configured webhook URL while Vercel still executes the catch-all API function. Webhook request bodies are read in the serverless function with Vercel body parsing disabled so Shopify HMAC verification receives the raw body.

Use `/auth/callback` as the Shopify Partner Dashboard redirect URL. `/api/auth/*` is the internal Vercel destination created by the rewrite.

## Branch Mapping

| Vercel environment | Branches |
| --- | --- |
| Production | `prod` |
| Preview | `main`, `backend`, `frontend`, `feature/*` |
| Development | Local development or Vercel CLI when needed |

`main` is the GitHub default and integration branch. It is not the production branch. `prod` is the production release branch. `dev` may exist temporarily as a legacy branch, but it should not receive new PRs or Vercel branch-specific setup.

Use stable Vercel project domains or configured custom domains for Shopify app URLs. Do not hardcode random preview deployment URLs in source code.

## Environment Variables

Configure environment variables in the Vercel dashboard for Development, Preview, and Production. Keep values scoped to the correct environment.

Required app variables:

- `NODE_ENV`
- `APP_ENV`
- `APP_URL`
- `SHOPIFY_APP_URL`
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_SCOPES`
- `SHOPIFY_API_VERSION`
- `DATABASE_URL`
- `SESSION_SECRET`
- `ENCRYPTION_KEY`
- `STORAGE_PROVIDER`
- `LOCAL_STORAGE_ROOT`
- `PUBLIC_MEDIA_BASE_URL`
- `FFMPEG_PATH`
- `FFPROBE_PATH`
- `MAX_VIDEO_SIZE_MB`
- `ALLOWED_VIDEO_MIME_TYPES`
- `QUEUE_PROVIDER`
- `ANALYTICS_ENABLED`

Testing and local-only variables:

- `TEST_DATABASE_URL`
- `PLAYWRIGHT_BASE_URL`

S3 or R2-compatible storage variables for production object storage:

- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_PUBLIC_BASE_URL`

Never commit real values for API secrets, database URLs, session secrets, encryption keys, Redis URLs, or object storage credentials. Keep `.env` files local and use `.env.example` only for safe placeholders.

## Shopify URLs

Set `APP_URL` and `SHOPIFY_APP_URL` to the stable Vercel URL for the environment.

See [Shopify config for Vercel environments](../shopify-config.md) for the Partner Dashboard, redirect URL, scope, and webhook strategy.

Production example:

```txt
APP_ENV=production
APP_URL=https://your-production-domain.example.com
SHOPIFY_APP_URL=https://your-production-domain.example.com
```

Preview example:

```txt
APP_ENV=preview
APP_URL=https://your-stable-preview-domain.example.com
SHOPIFY_APP_URL=https://your-stable-preview-domain.example.com
```

Shopify app configuration requires matching URLs:

- Application URL: `${SHOPIFY_APP_URL}`
- OAuth redirect URL: `${SHOPIFY_APP_URL}/auth/callback`
- Webhook URL: `${SHOPIFY_APP_URL}/webhooks`

The Vercel runtime must have access to the Shopify API secret, session secret, and database URL through Vercel environment variables only.

## Database and Prisma

Use managed Postgres for Preview and Production. `DATABASE_URL` must point at the correct database for each Vercel environment.

Prisma uses `prisma.config.ts` and `packages/db/prisma/schema.prisma`. The current CI generates the Prisma client before checks. Vercel builds run `npm run vercel:build`, which generates the Prisma client before the TypeScript package builds, and Vercel compiles the serverless runtime from `api/[...path].ts`.

Do not run destructive migrations automatically from Vercel builds. Migration strategy should be documented separately before production launch.

## Storage

Local development can use:

```txt
STORAGE_PROVIDER=local
LOCAL_STORAGE_ROOT=./.data/storage
```

Production must use object storage through the provider interface planned for the upload feature. Configure S3 or R2-compatible variables in Vercel. Vercel filesystem storage is ephemeral and must not be used for persistent uploaded videos or thumbnails.

## FFmpeg and Workers

The video worker and FFmpeg processing are not deployed in this PR. Configure `FFMPEG_PATH` and `FFPROBE_PATH` for the future worker runtime, not for the current static admin shell.

## External Services Deferred

The following are intentionally not implemented in this deployment/runtime foundation:

- Product search.
- Manual video upload.
- Video processing.
- Storefront widget.
- Analytics ingestion.
- Meta, Instagram, TikTok, Facebook, or social import integrations.
