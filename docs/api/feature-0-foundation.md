# Feature 0 API Surface

## `GET /health`

Returns app liveness metadata.

```json
{
  "ok": true,
  "service": "shoppable-video-shopify-app"
}
```

The route is intentionally unauthenticated so deployment and Playwright smoke checks can verify that the app process is running.
