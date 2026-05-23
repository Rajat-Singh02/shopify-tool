Feature 3 Manual Video Upload QA
================================

Prerequisites
-------------

- Feature 1 embedded app works.
- Feature 2 stack is included if testing the full stacked branch.
- Feature 3A backend upload routes are included.
- Feature 3B frontend upload UI is included.
- Stable QA URL: `https://shopify-tool-git-main-rajat-sahadev-s-projects.vercel.app`.
- Shopify store has an installed app with connected shop context.
- Test files are available:
  - valid small MP4 under `MAX_VIDEO_SIZE_MB`
  - invalid MIME file, such as `.txt`
  - oversized file if feasible
- Do not share bearer tokens or screenshots containing tokens.

QA Checklist
------------

### A. Route Checks Outside Shopify Admin

- [ ] `GET /health` returns 200.
- [ ] `GET /api/admin/dashboard` without bearer returns safe 410.
- [ ] Upload endpoints without bearer return safe 401/410.
- [ ] Root HTML includes Shopify App Bridge meta/script.

### B. Shopify Admin Embedded App

- [ ] Open Shopify Admin -> Apps -> ANTIQUINN/Shoppable Video.
- [ ] App loads inside Shopify Admin.
- [ ] Dashboard shows connected shop domain.
- [ ] Videos navigation item is visible.
- [ ] Videos page loads without crashing.
- [ ] Manual upload area is visible.

### C. Upload Validation

- [ ] Upload button is disabled before selecting a file.
- [ ] Selecting a valid MP4 shows filename, size, and MIME type.
- [ ] Selecting unsupported MIME shows safe validation error.
- [ ] Selecting oversized file shows safe validation error.
- [ ] No API request is sent for invalid local validation.

### D. Upload Flow

- [ ] Valid upload creates upload intent.
- [ ] File upload request is sent to returned upload URL.
- [ ] Complete-upload request is sent after file upload succeeds.
- [ ] Loading state appears for upload steps.
- [ ] Success state shows video id/status.
- [ ] Choose another/reset works.
- [ ] Refresh page does not expose secrets or crash.
- [ ] Upload network failure shows safe error and keeps the page usable.
- [ ] Truncated upload or mismatched Content-Length is rejected safely.
- [ ] Concurrent/repeated complete-upload requests do not create duplicate unsafe work.
- [ ] Large-file behavior matches the current provider limits; serverless/local upload does not claim production-size signed URL support.

### E. Network/Security

- [ ] Upload API requests use stable QA URL.
- [ ] Requests include `Authorization: Bearer` header.
- [ ] Do not copy/share the token.
- [ ] Response body does not include `accessToken`, `session`, API secret, `DATABASE_URL`, filesystem path, or bearer token.
- [ ] Local storage filesystem path is never exposed to browser.
- [ ] Bearer token is sent only to same-origin admin API routes, not cross-origin upload targets.
- [ ] Errors are safe merchant-facing messages.

### F. Supabase

- [ ] Video row is created for the current shop.
- [ ] `source = MANUAL_UPLOAD`.
- [ ] `status` is appropriate for uploaded/pending-processing.
- [ ] No product tags are required.
- [ ] Do not paste sensitive columns if any.

Useful Supabase verification SQL:

```sql
select
  "id",
  "shopId",
  "source",
  "status",
  "originalFilename",
  "contentType",
  "sizeBytes",
  "createdAt",
  "updatedAt"
from "Video"
order by "updatedAt" desc
limit 10;
```

### G. Regression

- [ ] Dashboard still loads connected shop.
- [ ] Products page/search still works if Feature 2 is in stack.
- [ ] No Example Domain page.
- [ ] No Vercel Deployment Protection 401.
- [ ] No Vercel 404/500 for normal upload flow.
- [ ] Videos upload does not break Products or Widgets navigation.
- [ ] Install/uninstall lifecycle still works.

### H. Out Of Scope For Feature 3

- [ ] Video transcoding/processing.
- [ ] Thumbnails.
- [ ] Product tagging.
- [ ] Storefront widget rendering.
- [ ] Analytics.
- [ ] Social imports.

### I. Pass/Fail Summary

- QA tester:
- Date:
- Store:
- Build/PRs tested:
- Passed:
- Failed:
- Notes:
