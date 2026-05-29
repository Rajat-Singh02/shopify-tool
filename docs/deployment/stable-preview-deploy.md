# Stable Preview Deploy

This repo can deploy the merged `main` branch to the stable Shopify QA URL without manually repeating the Vercel CLI commands.

Stable preview URL:

```text
https://shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app
```

Correct Vercel project:

```text
shopify-tool-live
```

Do not deploy or alias the typo project `shoify-tool`.

## GitHub Actions Setup

The workflow `.github/workflows/deploy-preview.yml` deploys automatically after the existing `CI` workflow succeeds on `main`. It can also be run manually from the GitHub Actions tab.

Add these GitHub repository secrets before relying on the workflow:

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

Use the `shopify-tool-live` project values only. Do not use values from `shopify-tool` or `shoify-tool`.

The workflow:

1. Pulls Preview env vars from Vercel.
2. Builds prebuilt Vercel output.
3. Verifies the Shopify public client ID meta tag.
4. Verifies admin/storefront/widget routes are present in Vercel output.
5. Deploys one Preview deployment.
6. Waits for a `Ready` deployment.
7. Aliases it to the stable Shopify QA URL.
8. Runs route checks for `/health`, root HTML, admin API auth behavior, and storefront widget routing.

The script also validates `shopify.app.antiquinn.toml` and `shopify.app.toml` before every deploy. If Shopify TOML or files under `extensions/` changed since `HEAD~1`, the script stops before Vercel aliasing unless Shopify config deploy has been handled.

To let the script run the Shopify CLI deploy:

```sh
SHOPIFY_CONFIG_DEPLOY=true npm run deploy:preview
```

To deploy Shopify config yourself first and then continue:

```sh
npx shopify app deploy --config shopify.app.antiquinn.toml
SHOPIFY_CONFIG_DEPLOYED=true npm run deploy:preview
```

Only use the existing Shopify app. If Shopify CLI asks to create a new app, stop and choose the existing app.

## Deploy The Latest UX PRs Now

PR #71 and PR #72 added the admin UX revamp, app embed/theme extension foundation, and setup wizard. To deploy those changes now from a laptop with Shopify CLI and Vercel CLI access:

```sh
git checkout main
git pull --ff-only origin main
```

Confirm the tracked Shopify config uses the live stable URL:

```sh
grep -nE 'application_url|embedded|auth/callback|client_id' shopify.app.antiquinn.toml shopify.app.toml
```

Expected values:

```text
client_id = "507ec4018317a9c292eed04878307f58"
application_url = "https://shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app"
embedded = true
redirect URL = "https://shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app/auth/callback"
```

Deploy the Shopify TOML/theme extension changes:

```sh
npx shopify app deploy --config shopify.app.antiquinn.toml
```

Then deploy and alias Vercel Preview. After PR #73 is merged, use:

```sh
SHOPIFY_CONFIG_DEPLOYED=true npm run deploy:preview
```

Before PR #73 is merged, use the manual fallback:

```sh
npx vercel pull --yes --environment=preview --git-branch main
npx vercel build
npx vercel deploy --prebuilt --target=preview --logs
npx vercel inspect <READY_PREVIEW_URL> --wait --timeout 180s
npx vercel alias set <READY_PREVIEW_URL> shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app
```

Never alias a deployment unless `vercel inspect` shows `Ready`.

## Manual Fallback

If GitHub Actions is unavailable, run:

```sh
npm run deploy:preview
```

The script refuses to run against the wrong linked Vercel project. If local `.vercel/project.json` is missing, link the repo first:

```sh
npx vercel link
```

Choose the existing `shopify-tool-live` project. Do not create a new Vercel project.

## After Deploy

Manual Shopify Admin QA:

1. Open Shopify Admin -> Apps -> ANTIQUINN/Shoppable Video.
2. Confirm the embedded iframe uses `shopify-tool-live-git-main-rajat-sahadev-s-projects.vercel.app`.
3. Confirm dashboard loads.
4. Confirm videos, widgets, setup wizard, app embed instructions, and storefront widget flow still work.
5. Confirm no random Vercel URL is used in Shopify app config.
