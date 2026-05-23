# Feature 2 Product and Variant Search QA

## Prerequisites

- Feature 1 embedded app works.
- Stable QA URL: `https://shopify-tool-git-main-rajat-sahadev-s-projects.vercel.app`.
- PR #27 backend product search is included in the deployed branch.
- PR #28 frontend product search UI is included in the deployed branch.
- Shopify store has at least one product with at least one variant.
- Do not share bearer tokens or screenshots containing tokens.

## A. Route Checks Outside Shopify Admin

- [ ] `GET /health` returns 200.
- [ ] `GET /api/admin/dashboard` without bearer returns safe 410.
- [ ] `GET /api/admin/products/search` without bearer returns safe 401/410.
- [ ] Root HTML includes Shopify App Bridge meta/script.

## B. Shopify Admin Embedded App

- [ ] Open Shopify Admin -> Apps -> ANTIQUINN/Shoppable Video.
- [ ] App loads inside Shopify Admin.
- [ ] Dashboard shows connected shop domain.
- [ ] Products navigation item is visible.
- [ ] Products page loads without crashing.

## C. Product Search Behavior

- [ ] Search input is visible and labeled.
- [ ] Search button is visible.
- [ ] Enter key triggers search.
- [ ] Loading state appears during search.
- [ ] Searching a known product term returns products.
- [ ] Product result shows title, handle, status.
- [ ] Featured image thumbnail appears when product has image.
- [ ] Variants render under product.
- [ ] Variant rows show title, SKU, price, and inventory quantity when available.
- [ ] Empty search/result displays safe empty state.
- [ ] API error displays safe error state.
- [ ] Load more appears only when `pageInfo.hasNextPage` is true.
- [ ] Load more appends/loads next page and does not duplicate obvious rows.

## D. Network And Security

- [ ] `/api/admin/products/search` request uses stable QA URL.
- [ ] Request includes `Authorization: Bearer ...` header.
- [ ] Do not copy/share the token.
- [ ] Response status is 200 for valid search.
- [ ] Response body does not include `accessToken`, `session`, API secret, `DATABASE_URL`, or bearer token.
- [ ] No secrets appear in UI.
- [ ] No raw Shopify GraphQL errors are shown to merchant.

## E. Regression

- [ ] Dashboard still loads connected shop.
- [ ] Install/uninstall lifecycle still works.
- [ ] No Example Domain page.
- [ ] No Vercel Deployment Protection 401.
- [ ] No Vercel 404/500 for normal product search flow.
- [ ] Product search does not break Videos or Widgets placeholder navigation.

## F. Supabase

- [ ] No new schema migration expected for Feature 2.
- [ ] Shop row remains present.
- [ ] `uninstalledAt` remains null while app is installed.

## G. Pass/Fail Summary

- QA tester:
- Date:
- Store:
- Build/PRs tested:
- Passed:
- Failed:
- Notes:
