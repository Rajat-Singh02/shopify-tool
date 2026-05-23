# Video Processing Foundation

Feature 4A adds the first backend worker seam for uploaded video processing. It can load an uploaded video record, resolve the original object through storage, run `ffprobe`, persist supported metadata, and move the video through safe status transitions.

## Scope

- Worker entrypoint: `workers/video/src/index.ts`
- Job handler: `processVideoJob({ videoId }, dependencies)`
- Metadata extraction: `ffprobe` via `FFPROBE_PATH`
- Status transitions:
  - `UPLOADED` -> `PROCESSING` -> `READY`
  - `PROCESSING` -> `FAILED` on storage or metadata failures
- Persisted metadata uses fields that already exist on `Video`: `durationMs`, `width`, and `height`.

The extractor also parses safe container and codec metadata for future use, but Feature 4A does not add schema fields for those values.

## Not Included

- Video transcoding
- Thumbnail generation
- Public processing endpoints
- Redis or live queue integration
- Frontend UI
- Product tagging
- Storefront widget rendering
- Analytics

## Runtime Notes

Use `execFile`-style process execution for `ffprobe`; do not shell-interpolate file paths. Storage resolvers must validate object keys and must not expose local filesystem paths to clients.

Future queue work should call `processVideoJob` after upload completion and pass the existing repository and storage provider dependencies.
