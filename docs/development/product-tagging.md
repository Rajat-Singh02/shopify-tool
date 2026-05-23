# Product Tagging Backend

Feature 6A adds backend-only product tagging foundations for videos.

## Endpoints

- `GET /api/admin/videos/:videoId/product-tags`
  - Lists active product/variant tags for a current-shop video.
- `POST /api/admin/videos/:videoId/product-tags`
  - Creates or reactivates one product/variant tag for a current-shop video.
- `DELETE /api/admin/videos/:videoId/product-tags/:tagId`
  - Soft-removes one active tag from a current-shop video.

All endpoints require embedded Shopify admin authentication and return safe JSON only.

## GID Rules

- `productId` must be a Shopify Product GID such as `gid://shopify/Product/123`.
- `variantId` must be a Shopify ProductVariant GID such as `gid://shopify/ProductVariant/456`.
- The current storage model is variant-level, so `variantId` is required in Feature 6A.
- Display fields are trimmed and length-limited before persistence.

## Idempotency

Adding the same product and variant for the same video reactivates and updates the existing tag instead of creating a duplicate active row.

Deleting a tag sets `isActive` to false. It does not delete analytics history and does not remove video or product data.

## Not Included

- Frontend tagging UI.
- Live Shopify validation during tag creation.
- Storefront widget rendering.
- Analytics.
- Product-level tags without a variant.

Future Feature 6B should add the embedded admin tagging UI on top of these endpoints.
