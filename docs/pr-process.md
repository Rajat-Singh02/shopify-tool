# Pull Request Process

## Required Checks

Before opening a PR, run:

```sh
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

Run E2E when relevant and currently supported:

```sh
npm run test:e2e
```

If an E2E check requires unavailable external Shopify or Vercel setup, do not mark it as passed. Document the blocker in the PR body and add or update a manual QA checklist.

## PR Body

Every PR should include:

- Summary
- Files changed
- Tests run
- Risks
- Out of scope

## Review Rules

- Route handlers call services.
- Services call repositories.
- Repositories own database access.
- Shared DTOs, enums, and Zod schemas live in `packages/shared`.
- Shopify API wrappers live in `packages/shopify`.
- Storefront widget code lives in `packages/widget`.
- Video worker code lives in `workers/video`.
- No business logic belongs in React components.
- No business logic belongs directly in route handlers.
- Every public endpoint validates input with Zod.
- Every database mutation must be scoped by shop ID.

## Release Promotion

Merge feature branches into their target lane after CI passes and review is complete. Promote stable lane branches forward with separate PRs:

- `backend` -> `main`
- `frontend` -> `main`
- `main` -> `prod`

`dev` is a legacy branch and should not receive new PRs.

Do not force-push protected branches.

## Secrets

Never commit real secrets, `.env` files, Shopify API secrets, database URLs, Vercel secrets, or production tokens. Use `.env.example` and deployment documentation for variable names only.
