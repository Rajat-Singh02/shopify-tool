# Feature 4 Video Processing QA

## Prerequisites

- Feature 1 embedded app works.
- Feature 2 product search stack is included if testing the full stacked branch.
- Feature 3 manual upload backend/frontend stack is included.
- Feature 4A worker foundation is included.
- Feature 4B upload completion dispatch is included.
- Stable QA URL: `https://shopify-tool-git-main-rajat-sahadev-s-projects.vercel.app`
- `FFPROBE_PATH` is configured.
- `ffprobe` is available in the runtime being tested.
- Test file available:
  - valid small MP4 with known duration/resolution
  - invalid/corrupt video file if feasible
- Do not share bearer tokens or screenshots containing tokens.

## QA Checklist

### A. Route Checks Outside Shopify Admin

- [ ] `GET /health` returns 200.
- [ ] `GET /api/admin/dashboard` without bearer returns safe 410.
- [ ] Upload endpoints without bearer return safe 401/410.
- [ ] Root HTML includes Shopify App Bridge meta/script.

### B. Shopify Admin Embedded App

- [ ] Open Shopify Admin -> Apps -> ANTIQUINN/Shoppable Video.
- [ ] App loads inside Shopify Admin.
- [ ] Dashboard shows connected shop domain.
- [ ] Videos page loads.
- [ ] Manual upload UI appears.
- [ ] Upload a valid small MP4.

### C. Processing Behavior

- [ ] Upload intent succeeds.
- [ ] File upload succeeds.
- [ ] Complete-upload succeeds.
- [ ] Processing dispatch runs after upload completion.
- [ ] Video status transitions through processing state if visible/testable.
- [ ] Final status becomes processed/ready equivalent if ffprobe succeeds.
- [ ] If ffprobe fails, status becomes failed equivalent with safe reason.
- [ ] Repeating complete-upload does not dispatch duplicate processing for already processing/ready/failed video.

### D. Metadata Verification

- [ ] Duration is captured when available.
- [ ] Width is captured when available.
- [ ] Height is captured when available.
- [ ] Format/codec may be parsed but not persisted if schema does not support it.
- [ ] Metadata values are reasonable for the test file.
- [ ] No filesystem paths are exposed to browser responses.

Useful Supabase SQL:

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
limit 10;
```

### E. Network/Security

- [ ] Requests use stable QA URL.
- [ ] Requests include Authorization: Bearer header where required.
- [ ] Do not copy/share the token.
- [ ] Response body does not include accessToken, session, API secret, DATABASE_URL, filesystem path, local storage root, or bearer token.
- [ ] Errors are safe merchant-facing messages.
- [ ] Vercel logs do not include secrets or bearer tokens.

### F. Operational Checks

- [ ] Verify ffprobe path configuration.
- [ ] Verify missing ffprobe produces safe failed processing state or safe operational error.
- [ ] Verify processing does not require Redis/external queue yet.
- [ ] Verify inline/memory dispatch is documented as preview/local behavior only.

### G. Regression

- [ ] Dashboard still loads connected shop.
- [ ] Products search still works if Feature 2 is in stack.
- [ ] Manual upload UI still works.
- [ ] No Example Domain page.
- [ ] No Vercel Deployment Protection 401.
- [ ] No Vercel 404/500 for normal upload + processing flow.
- [ ] Install/uninstall lifecycle still works.

### H. Out Of Scope For Feature 4

- Transcoding.
- Thumbnail generation.
- Adaptive streaming.
- Product tagging.
- Storefront widget rendering.
- Analytics.
- Social imports.
- Production queue/retry semantics.

## Pass/Fail Summary

- QA tester:
- Date:
- Store:
- Build/PRs tested:
- Test video:
- Passed:
- Failed:
- Notes:
