# Storefront Widget Foundation

Feature 7A adds public storefront routes for loading a shoppable video widget payload and a small dependency-free bootstrap script. Feature 7B adds minimal authenticated admin widget management for creating widgets, attaching ready videos, and copying the storefront embed snippet.

## Script Tag

```html
<script
  src="https://shopify-tool-git-main-rajat-sahadev-s-projects.vercel.app/widget.js"
  data-shop="example.myshopify.com"
  data-widget-id="widget-id"
></script>
```

The script reads `data-shop` and `data-widget-id`, fetches the public widget payload, and renders a minimal widget container. It does not send analytics in this feature.

## Public Routes

- `GET /widget.js`
  - Returns the bootstrap script.
  - Public route, no admin session required.
  - Content type is `application/javascript`.

- `GET /api/storefront/widgets/:widgetId?shop=<shop>.myshopify.com`
  - Returns one published widget for the requested shop.
  - Public route, no admin session required.
  - Returns only public-safe widget, video, and product tag fields.

## Public Data Rules

The storefront payload must not expose access tokens, sessions, API secrets, `DATABASE_URL`, bearer tokens, filesystem paths, local storage root, storage keys, or raw Shopify responses.

Only `READY` videos are returned. Archived, failed, uploaded, and processing videos are filtered out. Product tags are limited to active variant-level tags.

If a video does not yet have a public media URL, `publicUrl` is `null`. Local storage filesystem paths are never returned.

## Admin Routes

- `GET /api/admin/widgets`
  - Lists current-shop widgets.
  - Requires embedded admin auth.

- `POST /api/admin/widgets`
  - Creates a current-shop widget with a title.
  - New widgets start in the safe default status from the backend schema.

- `GET /api/admin/widgets/:widgetId`
  - Returns one current-shop widget with attached videos.

- `PATCH /api/admin/widgets/:widgetId`
  - Updates editable basics only: title and status.

- `POST /api/admin/widgets/:widgetId/videos`
  - Attaches a current-shop ready video to the widget.
  - Re-adding the same video is idempotent.

- `DELETE /api/admin/widgets/:widgetId/videos/:videoId`
  - Detaches a video from the widget.
  - Does not delete the video or storage object.

The admin Widgets page lists widgets, creates widgets, edits title/status, attaches ready manual-upload videos, detaches videos, and shows this embed snippet with the connected shop domain and selected widget ID:

```html
<script
  src="https://shopify-tool-git-main-rajat-sahadev-s-projects.vercel.app/widget.js"
  data-shop="example.myshopify.com"
  data-widget-id="widget-id"
></script>
```

## Current Limitations

- No analytics yet.
- No theme app extension yet.
- No advanced styling or layout editor yet.
- Public media URL may be null until media serving is finalized.
- No thumbnails or transcoding yet.
