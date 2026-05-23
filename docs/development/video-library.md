# Video Library Backend

Feature 5A adds backend-only video library endpoints for the authenticated shop.

## Endpoints

- `GET /api/admin/videos`
  - Lists videos for the current shop.
  - Supports `first`, `after`, `status`, `source`, and `q` filters.
- `GET /api/admin/videos/:videoId`
  - Returns one safe video detail DTO for the current shop.
- `POST /api/admin/videos/:videoId/archive`
  - Soft-archives a video by setting status to `ARCHIVED`.

All endpoints require embedded Shopify admin authentication and must return safe JSON only.

## Lifecycle Limits

Archive is non-destructive. Feature 5A does not physically delete local storage objects and does not add restore because the current schema does not preserve the previous pre-archive status.

## Not Included

- Frontend video library UI.
- Product tagging.
- Storefront widget rendering.
- Analytics.
- New processing/transcoding behavior.
- Thumbnail generation.
