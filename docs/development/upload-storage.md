Manual Upload Storage
=====================

Feature 3A adds backend-only manual upload foundations. There is no merchant upload UI and no video processing in this PR.

Endpoints
---------

All endpoints require the same embedded Shopify Admin authentication used by the dashboard.

- `POST /api/admin/videos/upload-intent`
  - Creates a `Video` row for the current shop.
  - Validates `filename`, `contentType`, and `sizeBytes`.
  - Returns a safe video DTO and a same-origin upload target.
- `PUT /api/admin/videos/:videoId/upload`
  - Local provider only.
  - Verifies the video belongs to the current shop.
  - Stores the original object under `LOCAL_STORAGE_ROOT`.
- `POST /api/admin/videos/:videoId/complete-upload`
  - Verifies the original object exists.
  - Marks the upload complete using the existing `UPLOADED` status.

Local Storage Provider
----------------------

Preview and local development use `STORAGE_PROVIDER=local` with `LOCAL_STORAGE_ROOT`.

The local provider validates object keys, rejects path traversal, writes only inside the configured root, and never returns filesystem paths to the browser.

Configuration
-------------

The upload foundation uses existing environment variables:

- `STORAGE_PROVIDER`
- `LOCAL_STORAGE_ROOT`
- `MAX_VIDEO_SIZE_MB`
- `ALLOWED_VIDEO_MIME_TYPES`

Out Of Scope
------------

- Upload frontend UI
- Transcoding or metadata extraction
- Product tagging
- Storefront widget rendering
- Analytics
- S3/R2 signed upload provider
