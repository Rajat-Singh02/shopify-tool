# Shopify Config for Vercel Environments

This project uses Vercel for deployed development, preview, and production testing. Do not use tunnel URLs for Shopify app configuration.

Shopify auth and webhook routes are served on Vercel through the Node serverless runtime defined in `api/[...path].ts`.

## Config Files

`shopify.app.toml` is the canonical Shopify app config in this repository.

Do not create separate `shopify.app.dev.toml` or `shopify.app.prod.toml` files unless a later Shopify CLI workflow needs explicit checked-in config variants. For now, environment-specific values should be managed through:

- Shopify Partner Dashboard app settings.
- Vercel environment variables.
- Shopify CLI deploy/update steps run intentionally for the target Shopify app.

This avoids committing branch-specific domains or accidental production values.

## Vercel URL Mapping

Use stable Vercel domains or custom domains for Shopify application URLs.

| Shopify use case | Branch or Vercel environment | URL strategy |
| --- | --- | --- |
| Production app | `prod` | Vercel Production URL or production custom domain |
| Development/test app | `main` | Stable Vercel preview/dev URL or dev custom domain |
| Backend/frontend validation | `backend`, `frontend` | Stable preview URL if OAuth testing is needed |
| Feature branch UI review | `feature/*` | Preview URL for visual review, not random OAuth callback configuration |

Random Vercel preview deployment URLs are poor OAuth callback targets because each deployment gets a different hostname. Shopify OAuth redirect URLs must match exactly, so changing preview URLs creates noisy Partner Dashboard updates and callback failures.

Prefer one stable dev/test Shopify app mapped to one stable `main` preview/dev Vercel domain for OAuth and webhook testing.

## Partner Dashboard Values

Each Shopify app in the Partner Dashboard needs values that match the Vercel environment it targets.

Required values:

- `SHOPIFY_API_KEY`, also represented as `client_id` in Shopify config.
- `SHOPIFY_API_SECRET`.
- App URL, also represented as `application_url`.
- Redirect URLs.
- Access scopes.

Production and development should usually be separate Shopify apps:

- Production Shopify app -> Vercel Production URL/custom production domain -> `prod`.
- Development Shopify app -> stable Vercel dev/preview URL/custom dev domain -> `main`.

Set matching Vercel environment variables:

```txt
APP_URL=https://<app-domain>
SHOPIFY_APP_URL=https://<app-domain>
SHOPIFY_API_KEY=<partner-dashboard-client-id>
SHOPIFY_API_SECRET=<partner-dashboard-client-secret>
SHOPIFY_SCOPES=read_products
SHOPIFY_API_VERSION=2026-04
```

Do not commit real values for API keys or secrets.

## Redirect URLs

The Shopify auth path prefix is `/auth`.

Expected redirect URL patterns:

```txt
https://<app-domain>/auth/callback
https://<app-domain>/api/auth/callback
```

Only keep redirect URLs that are actually implemented and used. The Vercel runtime rewrites `/auth/*` to the serverless function while preserving the Shopify auth path prefix for the Shopify auth helper.

## App URL

The Shopify app URL must match the deployed Vercel domain:

```txt
application_url = "https://<app-domain>"
```

For local development, use a stable deployed Vercel dev URL for Shopify install/OAuth testing instead of a tunnel URL. Pure local UI and unit tests can still use localhost where Shopify callbacks are not involved.

## Scopes

Current active v1 scope:

```txt
read_products
```

Near-term scopes may include:

- `read_products` for product and variant lookup.
- `read_files` and `write_files` only if Shopify Files is used for media storage.

The planned object storage provider can avoid Shopify Files for uploaded media, so do not add file scopes until a feature actually requires them.

Do not add social integration scopes. Meta, Instagram, TikTok, Facebook, social OAuth, social import buttons, and backend social fetch jobs are out of scope for v1.

## Webhooks

The lifecycle webhook handler runs through the Vercel serverless runtime.

Expected lifecycle webhook:

```txt
app/uninstalled -> https://<app-domain>/webhooks
```

The current `shopify.app.toml` reserves the `app/uninstalled` subscription shape. Runtime HMAC verification and idempotent processing are implemented by the `/webhooks` route.

## Environment Checklist

For each Shopify app/environment pair:

1. Set Vercel environment variables for the matching environment.
2. Set Shopify Partner Dashboard App URL to the matching Vercel domain.
3. Set OAuth redirect URLs to the implemented callback route on the same domain.
4. Set scopes to the minimum required list.
5. Register lifecycle webhooks only after the runtime endpoint exists.
6. Run install/auth QA against the same domain configured in Shopify.

## Do Not

- Do not use tunnel URLs for Shopify app configuration.
- Do not hardcode random Vercel preview deployment URLs.
- Do not commit `.env` files or real secrets.
- Do not share API keys between production and development Shopify apps unless explicitly approved.
- Do not add social integration scopes or social import configuration.
