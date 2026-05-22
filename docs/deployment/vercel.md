# Vercel Deployment Foundation

This app deploys to Vercel. Do not use tunneling URLs for Shopify development, preview, or production setup.

Feature 0 is a static admin shell and health route foundation. Shopify OAuth, authenticated app routes, webhooks, video upload, processing, widgets, and analytics are intentionally deferred to later PRs.

## Project Setup

1. Create or import the GitHub repository in Vercel.
2. Set the Vercel project root to the repository root.
3. Use the existing install and build commands:

   ```sh
   npm ci
   npm run build
   ```

4. Use `apps/shopify-app/dist/client` as the output directory.
5. Connect Vercel Production to the `prod` branch.
6. Allow Preview deployments for `dev`, `backend`, `frontend`, and `feature/*` branches.

The repository includes `vercel.json` for the current static build output. Do not add secrets or branch-specific Shopify URLs to `vercel.json`.

## Branch Mapping

| Vercel environment | Branches |
| --- | --- |
| Production | `prod` |
| Preview | `dev`, `backend`, `frontend`, `feature/*` |
| Development | Local development or Vercel CLI when needed |

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
- Webhook URL: `${SHOPIFY_APP_URL}/webhooks` once webhooks are implemented

OAuth runtime wiring is deferred to Feature 1, so these URLs document the required shape without implementing auth in this PR.

## Database and Prisma

Use managed Postgres for Preview and Production. `DATABASE_URL` must point at the correct database for each Vercel environment.

Prisma uses `prisma.config.ts` and `packages/db/prisma/schema.prisma`. The current CI generates the Prisma client before checks. Vercel builds use the existing root build command; if later server code imports Prisma client during the build, add Prisma generation to the build pipeline in a dedicated PR.

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

The following are intentionally not implemented in this deployment foundation:

- Shopify OAuth/session runtime.
- Shopify webhook runtime.
- Product search.
- Manual video upload.
- Video processing.
- Storefront widget.
- Analytics ingestion.
- Meta, Instagram, TikTok, Facebook, or social import integrations.
