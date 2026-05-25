Manual Upload Storage
=====================

Manual uploads use the same authenticated admin API surface as the embedded app. Local development can store files on disk. Vercel preview should use database-backed preview storage so storefront media is still readable after the upload request finishes.

Endpoints
---------

All endpoints require the same embedded Shopify Admin authentication used by the dashboard.

- `POST /api/admin/videos/upload-intent`
  - Creates a `Video` row for the current shop.
  - Validates `filename`, `contentType`, and `sizeBytes`.
  - Returns a safe video DTO and a same-origin upload target.
- `PUT /api/admin/videos/:videoId/upload`
  - Stores the original object through the configured storage provider.
  - Verifies the video belongs to the current shop.
- `POST /api/admin/videos/:videoId/complete-upload`
  - Verifies the original object exists.
  - Marks the upload complete and dispatches processing.

Local Storage Provider
----------------------

Preview and local development use `STORAGE_PROVIDER=local` with `LOCAL_STORAGE_ROOT`.

The local provider validates object keys, rejects path traversal, writes only inside the configured root, and never returns filesystem paths to the browser.

Local storage is not durable on Vercel. It is acceptable for local development, but uploaded files can disappear across serverless function invocations or deployments.

Database Preview Storage
------------------------

Vercel preview should use `STORAGE_PROVIDER=database`. This stores original upload bytes in the `VideoStorageObject` table and lets the storefront media route serve video bytes from the database.

This provider is intended for preview and QA-sized files. Production should still move to object storage/CDN such as R2 or S3 before larger merchant usage.

Existing files uploaded while `STORAGE_PROVIDER=local` was active cannot be recovered if the Vercel function filesystem no longer has them. Re-upload those videos after switching preview to `database`.

Configuration
-------------

The upload foundation uses existing environment variables:

- `STORAGE_PROVIDER`
- `LOCAL_STORAGE_ROOT`
- `MAX_VIDEO_SIZE_MB`
- `ALLOWED_VIDEO_MIME_TYPES`

Out Of Scope
------------

- Analytics
- S3/R2 signed upload provider
- Production CDN/media hardening
