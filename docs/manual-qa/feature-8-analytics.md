# Feature 8 Analytics QA

## Prerequisites

- Feature 1 embedded app works.
- Feature 7 storefront widget stack is included.
- Feature 8A storefront analytics ingestion is included.
- Feature 8B admin analytics summary API is included.
- Stable QA URL: `https://shopify-tool-git-main-rajat-sahadev-s-projects.vercel.app`
- A widget exists with at least one READY video attached.
- Widget has at least one variant-level product tag if testing PRODUCT_CLICK.
- Do not share bearer tokens or screenshots containing tokens.

## QA checklist

### A. Route checks outside Shopify Admin

- [ ] GET `/health` returns 200.
- [ ] GET `/widget.js` returns JavaScript content.
- [ ] POST `/api/storefront/events` rejects invalid JSON safely.
- [ ] POST `/api/storefront/events` rejects unknown event type safely.
- [ ] POST `/api/storefront/events` rejects invalid shop safely.
- [ ] GET `/api/admin/analytics/summary` without bearer returns safe 401/410.
- [ ] GET `/api/admin/analytics/events` without bearer returns safe 401/410.

### B. Storefront widget event generation

- [ ] Load widget snippet on a test storefront/static page.
- [ ] Widget payload fetch succeeds.
- [ ] WIDGET_VIEW is sent after widget render.
- [ ] VIDEO_IMPRESSION is sent for rendered video item.
- [ ] VIDEO_PLAY is sent when video play event fires, if publicUrl/video element exists.
- [ ] VIDEO_PAUSE is sent when video pause event fires, if publicUrl/video element exists.
- [ ] PRODUCT_CLICK is sent when product/variant tag/button is clicked.
- [ ] Analytics failures do not break widget rendering.
- [ ] No cookies are required.
- [ ] No admin bearer token is sent from storefront event requests.

### C. Public event request safety

- [ ] Event request uses stable QA URL.
- [ ] Payload includes only safe IDs and event type.
- [ ] Payload does not include accessToken, session, API secret, DATABASE_URL, filesystem path, bearer token, cookies, raw headers, or PII.
- [ ] Response is safe JSON.
- [ ] Vercel logs do not include secrets or full sensitive payloads.

### D. Supabase verification

Useful SQL:

```sql
select
  "id",
  "shopId",
  "widgetId",
  "videoId",
  "eventType",
  "metadata",
  "createdAt"
from "AnalyticsEvent"
order by "createdAt" desc
limit 50;
```

Check:

- [ ] Events were inserted for the correct shop/widget/video.
- [ ] Event type mapping is expected.
- [ ] Metadata is small and safe.
- [ ] No PII/cookies/bearer tokens/secrets are stored.

### E. Admin analytics summary API

- [ ] Open Shopify Admin -> Apps -> ANTIQUINN/Shoppable Video.
- [ ] Use authenticated request or browser devtools to call:
  GET `/api/admin/analytics/summary`
- [ ] Response status is 200.
- [ ] Summary only includes current-shop events.
- [ ] Totals are non-negative.
- [ ] Counts include widget views, impressions, plays/pauses, product clicks where available.
- [ ] Date range filters work.
- [ ] widgetId filter works.
- [ ] videoId filter works.
- [ ] Invalid date range returns safe 400.
- [ ] Wrong-shop widget/video filter returns safe 404 or safe error.

### F. Admin analytics events API

- [ ] Authenticated GET `/api/admin/analytics/events` returns safe event DTOs.
- [ ] Pagination works.
- [ ] eventType filter works.
- [ ] date filters work.
- [ ] widget/video filters work.
- [ ] Response does not include raw metadata if unsafe, cookies, raw headers, bearer token, accessToken, API secret, DATABASE_URL, or filesystem path.

### G. Regression

- [ ] Dashboard still loads connected shop.
- [ ] Products search still works.
- [ ] Manual upload still works.
- [ ] Video processing still works if Feature 4 is in stack.
- [ ] Video library still works.
- [ ] Product tagging still works.
- [ ] Widget management still works.
- [ ] Public widget payload still works.
- [ ] No Example Domain page.
- [ ] No Vercel Deployment Protection 401.
- [ ] No Vercel 404/500 for normal analytics flow.
- [ ] Install/uninstall lifecycle still works.

### H. Out of scope for Feature 8

- Admin analytics dashboard charts.
- External analytics providers.
- Cookies.
- Fingerprinting.
- PII collection.
- Advanced attribution.
- Checkout/cart events.
- Production-grade rate limiting.
- Theme app extension.

### I. Pass/fail summary

- QA tester:
- Date:
- Store:
- Build/PRs tested:
- Widget tested:
- Video tested:
- Events generated:
- Passed:
- Failed:
- Notes:
