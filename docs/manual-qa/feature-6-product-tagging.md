# Feature 6 Product Tagging QA

## Prerequisites

- Feature 1 embedded app works.
- Feature 2 product/variant search stack is included.
- Feature 3 manual upload stack is included.
- Feature 4 processing stack is included if testing processed videos.
- Feature 5 video library stack is included.
- Feature 6A backend tagging endpoints are included.
- Feature 6B frontend tagging UI is included.
- Stable QA URL: `https://shopify-tool-git-main-rajat-sahadev-s-projects.vercel.app`.
- Store has at least one uploaded video.
- Store has at least one Shopify product with at least one variant.
- Current schema supports variant-level tags; product-only tags are out of scope.
- Do not share bearer tokens or screenshots containing tokens.

## QA Checklist

### A. Route Checks Outside Shopify Admin

- [ ] `GET /health` returns 200.
- [ ] `GET /api/admin/dashboard` without bearer returns safe 410.
- [ ] `GET /api/admin/videos/:videoId/product-tags` without bearer returns safe 401/410.
- [ ] `POST /api/admin/videos/:videoId/product-tags` without bearer returns safe 401/410.
- [ ] `DELETE /api/admin/videos/:videoId/product-tags/:tagId` without bearer returns safe 401/410.
- [ ] Root HTML includes Shopify App Bridge meta/script.

### B. Shopify Admin Embedded App

- [ ] Open Shopify Admin -> Apps -> ANTIQUINN/Shoppable Video.
- [ ] App loads inside Shopify Admin.
- [ ] Dashboard shows connected shop domain.
- [ ] Videos page loads.
- [ ] Video library loads.
- [ ] Select/open a video detail panel.
- [ ] Product tagging panel appears for the selected video.

### C. Existing Tag Loading

- [ ] Existing tags load when a video is selected.
- [ ] Loading state appears while fetching tags.
- [ ] Empty state appears when no tags exist.
- [ ] Safe error state appears if tag fetch fails.
- [ ] Existing tags show safe product/variant fields:
  - product title/handle if available
  - variant title
  - SKU if available
  - created timestamp if shown
- [ ] No raw Shopify response is shown.

### D. Product/Variant Search For Tagging

- [ ] Search input is visible and labeled.
- [ ] Search button is visible.
- [ ] Enter key triggers search.
- [ ] Loading state appears during search.
- [ ] Searching a known product term returns products.
- [ ] Product results show title/handle/status.
- [ ] Variants show title, SKU, price, inventory where available.
- [ ] Products with no variants show safe no-variants state.
- [ ] API errors show safe merchant-facing error.
- [ ] Product-only tag action is not available because backend requires `variantId`.
- [ ] Rapid product searches do not let stale search results replace the current query results.

### E. Add Tag

- [ ] Selecting a variant adds a tag using `POST /api/admin/videos/:videoId/product-tags`.
- [ ] Request includes `productId` and `variantId`.
- [ ] Request uses stable QA URL.
- [ ] Request includes `Authorization: Bearer` header.
- [ ] Do not copy/share the token.
- [ ] Successful add updates tag list.
- [ ] Adding the same product/variant twice does not create duplicate visible active tags.
- [ ] Backend idempotency is handled gracefully.
- [ ] Add failures do not wipe the existing valid tag list.
- [ ] Invalid GIDs are rejected safely if tested.

### F. Remove Tag

- [ ] Remove action is visible for existing tag.
- [ ] Remove action calls `DELETE /api/admin/videos/:videoId/product-tags/:tagId`.
- [ ] Successful remove updates tag list.
- [ ] Removing already-removed/missing tag shows safe behavior.
- [ ] Wrong-video/wrong-shop behavior returns safe error if testable.
- [ ] Cross-shop tag IDs cannot be removed from the current shop video.

### G. Archived Video Behavior

- [ ] Archived videos cannot be tagged if backend blocks it.
- [ ] UI shows safe blocked/error state for archived video tagging.
- [ ] Existing tags on archived videos remain safely viewable if implemented.
- [ ] No crash occurs.

### H. Network/Security

- [ ] All tagging API requests use stable QA URL.
- [ ] Requests include `Authorization: Bearer` header where required.
- [ ] Do not copy/share tokens.
- [ ] Response bodies do not include accessToken, session, API secret, `DATABASE_URL`, filesystem path, local storage root, bearer token, or raw Shopify response.
- [ ] Errors are safe merchant-facing messages.
- [ ] Vercel logs do not include secrets or bearer tokens.

### I. Supabase Verification

Useful SQL:

```sql
select
  "id",
  "videoId",
  "shopifyProductId",
  "shopifyVariantId",
  "productTitle",
  "variantTitle",
  "sku",
  "removedAt",
  "createdAt",
  "updatedAt"
from "VideoProductTag"
order by "updatedAt" desc
limit 20;
```

Check:

- [ ] Tag row exists for selected video.
- [ ] `shopifyVariantId` is populated.
- [ ] `removedAt` is null for active tag.
- [ ] `removedAt` becomes non-null or row is absent after removal, depending on implementation.
- [ ] No schema migration is expected for Feature 6.

### J. Regression

- [ ] Dashboard still loads connected shop.
- [ ] Products page/search still works.
- [ ] Manual upload still works.
- [ ] Processing still works if Feature 4 is in stack.
- [ ] Video library list/detail/archive still works.
- [ ] No Example Domain page.
- [ ] No Vercel Deployment Protection 401.
- [ ] No Vercel 404/500 for normal tagging flow.
- [ ] Install/uninstall lifecycle still works.

### K. Out Of Scope For Feature 6

- Product-only tags.
- Storefront widget rendering.
- Analytics.
- Transcoding.
- Thumbnail generation.
- Physical storage deletion.
- Social imports.
- Live Shopify validation of tag IDs unless implemented separately.

### L. Pass/Fail Summary

- QA tester:
- Date:
- Store:
- Build/PRs tested:
- Video tested:
- Product/variant tested:
- Passed:
- Failed:
- Notes:
