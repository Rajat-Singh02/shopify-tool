# Feature 7 Storefront Widget QA

## Prerequisites

- Feature 1 embedded app works.
- Feature 2 product/variant search stack is included.
- Feature 3 manual upload stack is included.
- Feature 4 processing stack is included if testing ready videos.
- Feature 5 video library stack is included.
- Feature 6 product tagging stack is included.
- Feature 7A backend storefront widget rendering foundation is included.
- Feature 7B admin widget management is included.
- Stable QA URL: `https://shopify-tool-git-main-rajat-sahadev-s-projects.vercel.app`
- Store has at least one uploaded READY video.
- Store has at least one variant-level product tag on that video.
- A widget exists and has at least one READY video attached.
- Note: `publicUrl` may be null until public media serving is finalized.
- Do not share bearer tokens or screenshots containing tokens.

## QA Checklist

### A. Route Checks Outside Shopify Admin

- [ ] GET `/health` returns 200.
- [ ] GET `/widget.js` returns JavaScript content.
- [ ] GET `/widget.js` does not expose secrets.
- [ ] GET `/api/storefront/widgets/:widgetId` without valid shop query returns safe 400.
- [ ] GET `/api/storefront/widgets/:widgetId?shop=<shop>.myshopify.com` returns 200 for valid published widget.
- [ ] Public storefront routes do not require admin bearer token.
- [ ] Root HTML includes Shopify App Bridge meta/script for admin app.

### B. Shopify Admin Embedded App

- [ ] Open Shopify Admin -> Apps -> ANTIQUINN/Shoppable Video.
- [ ] App loads inside Shopify Admin.
- [ ] Dashboard shows connected shop domain.
- [ ] Widgets navigation item is visible.
- [ ] Widgets page loads.
- [ ] Existing widgets list loads.
- [ ] Empty state appears if no widgets exist.
- [ ] Create widget form appears.

### C. Admin Widget Management

- [ ] Create widget with valid title.
- [ ] Invalid/empty title shows safe validation error.
- [ ] Widget appears in list after creation.
- [ ] Open widget detail.
- [ ] Edit widget title/status if supported.
- [ ] Attach READY/non-archived video to widget.
- [ ] Attempting to attach archived/not-ready video is blocked if applicable.
- [ ] Attached video appears in widget detail.
- [ ] Detach video works and updates UI.
- [ ] Re-attaching same video is idempotent/safe.
- [ ] No storage paths or secrets appear in UI.

### D. Embed Snippet

- [ ] Widget detail shows script snippet:

```html
<script src="https://shopify-tool-git-main-rajat-sahadev-s-projects.vercel.app/widget.js" data-shop="<shop>.myshopify.com" data-widget-id="<widget-id>"></script>
```

- [ ] Snippet uses stable QA URL.
- [ ] Snippet uses connected shop domain.
- [ ] Snippet uses selected widget ID.
- [ ] Copy snippet button works if implemented.
- [ ] Snippet does not include secrets, tokens, `DATABASE_URL`, or local filesystem paths.

### E. Public Widget Payload

- [ ] Call:

```text
GET https://shopify-tool-git-main-rajat-sahadev-s-projects.vercel.app/api/storefront/widgets/<widget-id>?shop=<shop>.myshopify.com
```

- [ ] Response contains public-safe widget id/title/status.
- [ ] Response contains only videos attached to that widget.
- [ ] Response contains only READY/non-archived videos.
- [ ] Response includes product/variant tags for videos.
- [ ] `publicUrl` is either safe http(s) URL or null.
- [ ] Response does not include accessToken, session, API secret, `DATABASE_URL`, filesystem path, local storage root, bearer token, raw Shopify response, or private storage key.
- [ ] Missing widget returns safe 404.
- [ ] Wrong shop returns safe 404.
- [ ] Invalid shop/widgetId returns safe 400.
- [ ] Public payload responses include CORS headers and support OPTIONS preflight.
- [ ] Multi-video widgets return deterministic video ordering.

### F. widget.js Storefront Smoke

- [ ] Add the snippet to a simple local/static HTML test page or Shopify theme custom liquid area if available.
- [ ] Page loads without crashing.
- [ ] `widget.js` reads `data-shop` and `data-widget-id`.
- [ ] `widget.js` fetches the public widget payload.
- [ ] Widget container renders.
- [ ] Script can be placed in the head or body and still mounts into a body-safe location.
- [ ] Widget styles are isolated from the theme where supported.
- [ ] Video placeholders or videos render depending on `publicUrl` availability.
- [ ] Product/variant tag text/buttons render safely.
- [ ] If payload fetch fails, widget fails gracefully without breaking the page.
- [ ] CSP/theme custom liquid constraints are checked for blocked script, fetch, and inline-style behavior.
- [ ] Keyboard focus and screen reader labels are acceptable for rendered widget controls.
- [ ] No analytics events are sent in Feature 7.

### G. Network/Security

- [ ] Public widget requests use stable QA URL.
- [ ] Public widget requests do not include admin Authorization bearer token.
- [ ] Admin widget management requests include Authorization bearer token.
- [ ] Do not copy/share admin token.
- [ ] Vercel logs do not include secrets or bearer tokens.
- [ ] Storefront widget does not expose admin-only fields.

### H. Supabase Verification

Useful SQL:

```sql
select
  "id",
  "shopId",
  "title",
  "status",
  "createdAt",
  "updatedAt"
from "Widget"
order by "updatedAt" desc
limit 20;

select
  "widgetId",
  "videoId",
  "position",
  "createdAt",
  "updatedAt"
from "WidgetVideo"
order by "updatedAt" desc
limit 20;
```

Check:

- [ ] Widget exists for current shop.
- [ ] WidgetVideo rows exist for attached videos.
- [ ] Attached videos are READY/non-archived.
- [ ] Product tags exist for attached videos if testing shoppable content.
- [ ] No schema migration is expected for Feature 7 unless already introduced.

### I. Regression

- [ ] Dashboard still loads connected shop.
- [ ] Products page/search still works.
- [ ] Manual upload still works.
- [ ] Processing still works if Feature 4 is in stack.
- [ ] Video library list/detail/archive still works.
- [ ] Product tagging still works.
- [ ] No Example Domain page.
- [ ] No Vercel Deployment Protection 401.
- [ ] No Vercel 404/500 for normal widget management/public payload flow.
- [ ] Install/uninstall lifecycle still works.

### J. Out Of Scope For Feature 7

- Analytics.
- Theme app extension.
- Advanced widget styling/layout editor.
- Transcoding.
- Thumbnail generation.
- Public media serving finalization if `publicUrl` is null.
- Social imports.
- Production CDN/media hardening.

### K. Pass/Fail Summary

- QA tester:
- Date:
- Store:
- Build/PRs tested:
- Widget tested:
- Video(s) tested:
- Product/variant tags tested:
- Passed:
- Failed:
- Notes:
