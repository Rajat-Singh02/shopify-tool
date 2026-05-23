# Storefront Widget Foundation

Feature 7A adds public storefront routes for loading a shoppable video widget payload and a small dependency-free bootstrap script.

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

## Current Limitations

- No admin widget UI yet.
- No analytics yet.
- No theme app extension yet.
- Public media URL may be null until media serving is finalized.
- No thumbnails or transcoding yet.
