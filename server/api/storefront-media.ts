import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import type { StorefrontWidgetRecord, VideoRecord, WidgetRepository } from "@shoppable-video/db";

const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const MAX_SHOP_DOMAIN_LENGTH = 255;
const MAX_ID_LENGTH = 160;

export type StorefrontMediaStorageResolver = {
  resolveOriginalObject(video: VideoRecord): Promise<string | StorefrontMediaObject>;
};

export type StorefrontMediaObject = {
  kind: "bytes";
  body: Uint8Array;
  contentType: string;
  sizeBytes: number;
};

export class StorefrontMediaExpectedError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly clientMessage = message,
  ) {
    super(message);
    this.name = "StorefrontMediaExpectedError";
  }
}

export async function serveStorefrontWidgetVideoMedia({
  request,
  storageResolver,
  widgetRepository,
}: {
  request: Request;
  storageResolver: StorefrontMediaStorageResolver;
  widgetRepository: Pick<WidgetRepository, "findPublishedStorefrontWidget">;
}): Promise<Response> {
  const { shopDomain, videoId, widgetId } = parseStorefrontMediaRequest(request);
  const widget = await widgetRepository.findPublishedStorefrontWidget(shopDomain, widgetId);
  const video = findPublicReadyWidgetVideo(widget, videoId);
  const mediaObject = await resolveOriginalObject(storageResolver, video);
  const mediaSize = getPublicMediaObjectSize(mediaObject);
  const byteRange = parseRangeHeader(request.headers.get("Range"), mediaSize);
  const headers = createMediaHeaders({
    contentType: mediaObject.kind === "bytes" ? mediaObject.contentType : video.originalMimeType,
    fileSize: mediaSize,
    range: byteRange,
  });

  if (request.method === "HEAD") {
    return new Response(null, {
      status: byteRange ? 206 : 200,
      headers,
    });
  }

  if (mediaObject.kind === "bytes") {
    return new Response(createByteStream(slicePublicMediaObject(mediaObject, byteRange)), {
      status: byteRange ? 206 : 200,
      headers,
    });
  }

  const stream = createReadStream(mediaObject.path, {
    start: byteRange?.start,
    end: byteRange?.end,
  });

  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
    status: byteRange ? 206 : 200,
    headers,
  });
}

function parseStorefrontMediaRequest(request: Request): {
  shopDomain: string;
  widgetId: string;
  videoId: string;
} {
  const url = new URL(request.url);
  const match = url.pathname.match(
    /^\/api\/storefront\/widgets\/([^/]+)\/videos\/([^/]+)\/media$/,
  );

  if (!match?.[1] || !match[2]) {
    throw new StorefrontMediaExpectedError("Video media was not found", 404);
  }

  return {
    shopDomain: validateShopDomain(url.searchParams.get("shop")),
    widgetId: validateSafeId(decodeURIComponent(match[1]), "widgetId"),
    videoId: validateSafeId(decodeURIComponent(match[2]), "videoId"),
  };
}

function findPublicReadyWidgetVideo(
  widget: StorefrontWidgetRecord | null,
  videoId: string,
): VideoRecord {
  if (!widget) {
    throw new StorefrontMediaExpectedError("Video media was not found", 404);
  }

  const widgetVideo = widget.widgetVideos.find((item) => item.video.id === videoId);
  const video = widgetVideo?.video;

  if (!video || video.status !== "READY" || video.source !== "MANUAL_UPLOAD") {
    throw new StorefrontMediaExpectedError("Video media was not found", 404);
  }

  return video;
}

type ResolvedStorefrontMediaObject =
  | {
      kind: "file";
      path: string;
      sizeBytes: number;
    }
  | StorefrontMediaObject;

async function resolveOriginalObject(
  storageResolver: StorefrontMediaStorageResolver,
  video: VideoRecord,
): Promise<ResolvedStorefrontMediaObject> {
  try {
    const resolved = await storageResolver.resolveOriginalObject(video);

    if (typeof resolved === "string") {
      const objectStat = await statPublicMediaObject(resolved);

      return {
        kind: "file",
        path: resolved,
        sizeBytes: objectStat.size,
      };
    }

    if (
      resolved.kind === "bytes" &&
      resolved.body.byteLength === resolved.sizeBytes &&
      resolved.sizeBytes > 0
    ) {
      return resolved;
    }

    throw new Error("invalid media object");
  } catch {
    throw new StorefrontMediaExpectedError("Video media was not found", 404);
  }
}

function getPublicMediaObjectSize(mediaObject: ResolvedStorefrontMediaObject): number {
  return mediaObject.kind === "bytes" ? mediaObject.sizeBytes : mediaObject.sizeBytes;
}

function slicePublicMediaObject(
  mediaObject: StorefrontMediaObject,
  range: ByteRange | null,
): Uint8Array {
  if (!range) {
    return mediaObject.body;
  }

  return mediaObject.body.slice(range.start, range.end + 1);
}

function createByteStream(body: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(body);
      controller.close();
    },
  });
}

async function statPublicMediaObject(objectPath: string): Promise<{
  isFile(): boolean;
  size: number;
}> {
  try {
    const objectStat = await stat(objectPath);

    if (!objectStat.isFile()) {
      throw new Error("not a file");
    }

    return objectStat;
  } catch {
    throw new StorefrontMediaExpectedError("Video media was not found", 404);
  }
}

type ByteRange = {
  start: number;
  end: number;
};

function parseRangeHeader(rangeHeader: string | null, fileSize: number): ByteRange | null {
  if (!rangeHeader) {
    return null;
  }

  const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);

  if (!match || fileSize < 1) {
    throw new StorefrontMediaExpectedError("Requested media range is invalid", 416);
  }

  const [, rawStart, rawEnd] = match;
  const hasStart = rawStart !== "";
  const hasEnd = rawEnd !== "";

  if (!hasStart && !hasEnd) {
    throw new StorefrontMediaExpectedError("Requested media range is invalid", 416);
  }

  if (!hasStart) {
    const suffixLength = Number(rawEnd);

    if (!Number.isInteger(suffixLength) || suffixLength < 1) {
      throw new StorefrontMediaExpectedError("Requested media range is invalid", 416);
    }

    return {
      start: Math.max(fileSize - suffixLength, 0),
      end: fileSize - 1,
    };
  }

  const start = Number(rawStart);
  const end = hasEnd ? Number(rawEnd) : fileSize - 1;

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= fileSize
  ) {
    throw new StorefrontMediaExpectedError("Requested media range is invalid", 416);
  }

  return {
    start,
    end: Math.min(end, fileSize - 1),
  };
}

function createMediaHeaders({
  contentType,
  fileSize,
  range,
}: {
  contentType: string;
  fileSize: number;
  range: ByteRange | null;
}): Headers {
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=60",
    "Content-Type": sanitizeContentType(contentType),
  });

  if (range) {
    headers.set("Content-Length", String(range.end - range.start + 1));
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${fileSize}`);
  } else {
    headers.set("Content-Length", String(fileSize));
  }

  return headers;
}

function sanitizeContentType(contentType: string): string {
  const normalized = contentType.trim().toLowerCase();

  return normalized.startsWith("video/") ? normalized : "application/octet-stream";
}

function validateShopDomain(value: unknown): string {
  if (typeof value !== "string") {
    throw new StorefrontMediaExpectedError("shop is required", 400);
  }

  const shopDomain = value.trim().toLowerCase();

  if (
    shopDomain.length === 0 ||
    shopDomain.length > MAX_SHOP_DOMAIN_LENGTH ||
    !SHOP_DOMAIN_PATTERN.test(shopDomain)
  ) {
    throw new StorefrontMediaExpectedError("shop is invalid", 400);
  }

  return shopDomain;
}

function validateSafeId(value: string, name: string): string {
  const safeId = value.trim();

  if (safeId.length === 0 || safeId.length > MAX_ID_LENGTH || /[/"'<>\\\s]/.test(safeId)) {
    throw new StorefrontMediaExpectedError(`${name} is invalid`, 400);
  }

  return safeId;
}
