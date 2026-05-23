# Feature 5 Video Library QA

## Prerequisites

- Feature 1 embedded app works.
- Feature 2 product search stack is included if testing full stacked branch.
- Feature 3 manual upload stack is included.
- Feature 4 processing stack is included.
- Feature 5A backend video library endpoints are included.
- Feature 5B frontend video library UI is included.
- Stable QA URL: `https://shopify-tool-git-main-rajat-sahadev-s-projects.vercel.app`
- Store has at least one uploaded video.
- Store has at least one processed/ready video if testing metadata display.
- Do not share bearer tokens or screenshots containing tokens.

## QA Checklist

### A. Route Checks Outside Shopify Admin

- [ ] `GET /health` returns 200.
- [ ] `GET /api/admin/dashboard` without bearer returns safe 410.
- [ ] `GET /api/admin/videos` without bearer returns safe 401/410.
- [ ] `GET /api/admin/videos/:videoId` without bearer returns safe 401/410.
- [ ] `POST /api/admin/videos/:videoId/archive` without bearer returns safe 401/410.
- [ ] Root HTML includes Shopify App Bridge meta/script.

### B. Shopify Admin Embedded App

- [ ] Open Shopify Admin -> Apps -> ANTIQUINN/Shoppable Video.
- [ ] App loads inside Shopify Admin.
- [ ] Dashboard shows connected shop domain.
- [ ] Videos page loads.
- [ ] Manual upload UI remains visible.
- [ ] Video library section appears.

### C. Video List Behavior

- [ ] Initial video list loads.
- [ ] Loading state appears while fetching.
- [ ] Empty state appears when no videos exist.
- [ ] Safe error state appears if API fails.
- [ ] Each video row/card shows safe fields:
  - original filename
  - status
  - source
  - content type
  - size
  - duration if available
  - width/height if available
  - created/updated timestamps if shown
- [ ] No filesystem paths are shown.
- [ ] No storage root or internal object path is shown.

### D. Filtering/Search

- [ ] Status filter works if available.
- [ ] Source filter works if available.
- [ ] Search/filter by filename works if available.
- [ ] Filters call API with expected query params.
- [ ] Clearing filters returns default list.
- [ ] Invalid filter values do not crash UI.
- [ ] Expired/missing bearer token shows a safe auth error.
- [ ] Rapid filter/search changes do not let stale responses overwrite the current list.

### E. Pagination

- [ ] Load more appears when `pageInfo.hasNextPage` is true.
- [ ] Load more uses `pageInfo.endCursor`.
- [ ] Loading state appears for pagination.
- [ ] Loaded items append or update predictably.
- [ ] No obvious duplicate rows are shown.
- [ ] Invalid/tampered cursor returns a safe 400 response.
- [ ] Double-clicking Load more does not duplicate rows.

### F. Detail Behavior

- [ ] Selecting/opening a video loads detail.
- [ ] Detail request uses stable QA URL.
- [ ] Detail response status is 200 for current shop video.
- [ ] Wrong/missing video shows safe 404 state.
- [ ] Detail view shows safe metadata only.
- [ ] Detail view does not expose filesystem paths, storage root, accessToken, session, API secret, `DATABASE_URL`, or bearer token.

### G. Archive Behavior

- [ ] Archive action shows confirmation.
- [ ] Archive calls `POST /api/admin/videos/:videoId/archive`.
- [ ] Archive requires Authorization bearer token.
- [ ] Archive succeeds for current shop video.
- [ ] Archived video status updates in UI.
- [ ] Repeating archive is safe/idempotent.
- [ ] Archive does not claim physical deletion.
- [ ] Archive/wrong-shop behavior returns safe error if testable.
- [ ] Cross-shop video IDs cannot be viewed or archived.

### H. Network/Security

- [ ] All video library API requests use stable QA URL.
- [ ] Requests include Authorization: Bearer header where required.
- [ ] Do not copy/share the token.
- [ ] Response bodies do not include accessToken, session, API secret, `DATABASE_URL`, filesystem path, local storage root, or bearer token.
- [ ] Errors are safe merchant-facing messages.
- [ ] Vercel logs do not include secrets or bearer tokens.

### I. Supabase Verification

Useful SQL:

```sql
select
  "id",
  "shopId",
  "source",
  "status",
  "originalFilename",
  "contentType",
  "sizeBytes",
  "durationMs",
  "width",
  "height",
  "createdAt",
  "updatedAt"
from "Video"
order by "updatedAt" desc
limit 20;
```

Check:

- [ ] Videos belong to current shop.
- [ ] Archive updates status to `ARCHIVED` or equivalent.
- [ ] No schema migration is expected for Feature 5.

### J. Regression

- [ ] Dashboard still loads connected shop.
- [ ] Products page/search still works if Feature 2 is in stack.
- [ ] Manual upload still works if Feature 3 is in stack.
- [ ] Processing still works if Feature 4 is in stack.
- [ ] No Example Domain page.
- [ ] No Vercel Deployment Protection 401.
- [ ] No Vercel 404/500 for normal video library flow.
- [ ] Install/uninstall lifecycle still works.

### K. Out Of Scope For Feature 5

- Product tagging.
- Storefront widget rendering.
- Analytics.
- Transcoding.
- Thumbnail generation.
- Physical storage deletion.
- Restore from archive unless separately implemented.
- Social imports.

### L. Pass/Fail Summary

- QA tester:
- Date:
- Store:
- Build/PRs tested:
- Uploaded video(s):
- Passed:
- Failed:
- Notes:
