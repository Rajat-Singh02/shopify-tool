# Storefront Analytics Foundation

Feature 8A adds minimal public event ingestion for the storefront widget. It records safe widget interaction events into the existing `AnalyticsEvent` table.

## Public Route

`POST /api/storefront/events`

Request:

```json
{
  "shop": "example.myshopify.com",
  "widgetId": "widget-id",
  "videoId": "video-id",
  "eventType": "WIDGET_VIEW",
  "productId": "gid://shopify/Product/123",
  "variantId": "gid://shopify/ProductVariant/456",
  "metadata": {
    "source": "widget"
  }
}
```

Response:

```json
{
  "ok": true
}
```

## Supported Storefront Event Types

- `WIDGET_VIEW`
- `VIDEO_IMPRESSION`
- `VIDEO_PLAY`
- `VIDEO_PAUSE`
- `PRODUCT_CLICK`

The database enum currently uses older event names. Feature 8A stores compatible database event types and keeps the original storefront event type in safe metadata:

- `WIDGET_VIEW` and `VIDEO_IMPRESSION` -> `WIDGET_VIEWED`
- `VIDEO_PLAY` and `VIDEO_PAUSE` -> `VIDEO_PLAYED`
- `PRODUCT_CLICK` -> `PRODUCT_CLICKED`

## Privacy Rules

- No cookies are required.
- No PII is collected.
- No raw IP address is intentionally stored.
- No Authorization headers or bearer tokens are accepted or stored.
- No access tokens, sessions, API secrets, `DATABASE_URL`, filesystem paths, local storage root, or private storage keys are exposed.
- Metadata is limited to small primitive values.

## Widget Script Behavior

`widget.js` sends analytics after successful widget rendering:

- `WIDGET_VIEW` after the widget renders.
- `VIDEO_IMPRESSION` for each rendered video item.
- `VIDEO_PLAY` and `VIDEO_PAUSE` from video element events when a public media URL exists.
- `PRODUCT_CLICK` when a product/variant button is clicked.

The script uses `navigator.sendBeacon` when available and falls back to `fetch` with `keepalive`. Analytics failures are ignored so storefront rendering is not blocked.

## Admin Routes

Feature 8B adds authenticated admin reporting endpoints. These routes use the embedded Shopify admin bearer-token flow and only return events for the current shop.

`GET /api/admin/analytics/summary`

Query params:

- `from`: optional ISO date.
- `to`: optional ISO date.
- `widgetId`: optional current-shop widget filter.
- `videoId`: optional current-shop video filter.

Response includes a bounded date range, total event counts, counts by storefront event type, counts by widget, and counts by video.

`GET /api/admin/analytics/events`

Query params:

- `first`: optional page size, default 20, max 50.
- `after`: optional event cursor.
- `from`: optional ISO date.
- `to`: optional ISO date.
- `eventType`: optional storefront event type.
- `widgetId`: optional current-shop widget filter.
- `videoId`: optional current-shop video filter.

Response includes safe event DTOs with event id, event type, widget id, video id, product id, variant id, and timestamp. Raw metadata is intentionally not returned.

## Current Limitations

- No admin analytics dashboard UI yet.
- No charts yet.
- No attribution.
- No external analytics providers.
- No cookies or invasive tracking.
- No hard rate-limit system beyond lightweight payload validation.
