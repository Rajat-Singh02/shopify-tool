import type {
  AdminWidgetRecord,
  VideoRecord,
  VideoRepository,
  WidgetRepository,
  WidgetStatus,
} from "@shoppable-video/db";

import type { VideoUploadShop } from "./video-upload.js";

const MAX_TITLE_LENGTH = 120;
const WIDGET_STATUSES = new Set<WidgetStatus>(["DRAFT", "PUBLISHED", "ARCHIVED"]);

export type SafeAdminWidgetDto = {
  id: string;
  title: string;
  status: WidgetStatus;
  layout: "INLINE_CAROUSEL";
  createdAt: string;
  updatedAt: string;
  videos: Array<{
    id: string;
    originalFilename: string;
    status: VideoRecord["status"];
    source: VideoRecord["source"];
    contentType: string;
    durationMs: number | null;
    width: number | null;
    height: number | null;
  }>;
};

export type AdminWidgetListResponse = {
  widgets: SafeAdminWidgetDto[];
};

export class AdminWidgetExpectedError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly clientMessage = message,
  ) {
    super(message);
    this.name = "AdminWidgetExpectedError";
  }
}

export async function listAdminWidgets({
  shop,
  widgetRepository,
}: {
  shop: VideoUploadShop;
  widgetRepository: Pick<WidgetRepository, "listByShop">;
}): Promise<AdminWidgetListResponse> {
  const widgets = await widgetRepository.listByShop(shop.id);

  return {
    widgets: widgets.map(toSafeAdminWidgetDto),
  };
}

export async function createAdminWidget({
  shop,
  input,
  widgetRepository,
}: {
  shop: VideoUploadShop;
  input: unknown;
  widgetRepository: Pick<WidgetRepository, "createForShop">;
}): Promise<SafeAdminWidgetDto> {
  const title = parseWidgetTitle(input);
  const widget = await widgetRepository.createForShop(shop.id, title);

  return toSafeAdminWidgetDto(widget);
}

export async function getAdminWidget({
  shop,
  widgetId,
  widgetRepository,
}: {
  shop: VideoUploadShop;
  widgetId: string;
  widgetRepository: Pick<WidgetRepository, "findByShop">;
}): Promise<SafeAdminWidgetDto> {
  const widget = await requireWidget(shop.id, widgetId, widgetRepository);

  return toSafeAdminWidgetDto(widget);
}

export async function updateAdminWidget({
  shop,
  widgetId,
  input,
  widgetRepository,
}: {
  shop: VideoUploadShop;
  widgetId: string;
  input: unknown;
  widgetRepository: Pick<WidgetRepository, "updateByShop">;
}): Promise<SafeAdminWidgetDto> {
  const update = parseWidgetUpdate(input);
  const widget = await widgetRepository.updateByShop(shop.id, validateWidgetId(widgetId), update);

  if (!widget) {
    throw new AdminWidgetExpectedError("Widget was not found", 404);
  }

  return toSafeAdminWidgetDto(widget);
}

export async function attachAdminWidgetVideo({
  shop,
  widgetId,
  input,
  widgetRepository,
  videoRepository,
}: {
  shop: VideoUploadShop;
  widgetId: string;
  input: unknown;
  widgetRepository: Pick<WidgetRepository, "findByShop" | "attachVideo">;
  videoRepository: Pick<VideoRepository, "findByShop">;
}): Promise<SafeAdminWidgetDto> {
  const safeWidgetId = validateWidgetId(widgetId);
  const videoId = parseVideoIdInput(input);
  const widget = await requireWidget(shop.id, safeWidgetId, widgetRepository);
  const video = await videoRepository.findByShop(shop.id, videoId);

  if (!video) {
    throw new AdminWidgetExpectedError("Video was not found", 404);
  }

  if (video.status !== "READY") {
    throw new AdminWidgetExpectedError("Only ready videos can be attached to a widget", 409);
  }

  await widgetRepository.attachVideo(shop.id, widget.id, video);
  const updatedWidget = await widgetRepository.findByShop(shop.id, widget.id);

  if (!updatedWidget) {
    throw new AdminWidgetExpectedError("Widget was not found", 404);
  }

  return toSafeAdminWidgetDto(updatedWidget);
}

export async function detachAdminWidgetVideo({
  shop,
  widgetId,
  videoId,
  widgetRepository,
}: {
  shop: VideoUploadShop;
  widgetId: string;
  videoId: string;
  widgetRepository: Pick<WidgetRepository, "findByShop" | "detachVideo">;
}): Promise<{ detached: true }> {
  const widget = await requireWidget(shop.id, widgetId, widgetRepository);

  await widgetRepository.detachVideo(shop.id, widget.id, validateVideoId(videoId));

  return {
    detached: true,
  };
}

export function toSafeAdminWidgetDto(widget: AdminWidgetRecord): SafeAdminWidgetDto {
  return {
    id: widget.id,
    title: widget.name,
    status: widget.status,
    layout: widget.layout,
    createdAt: widget.createdAt.toISOString(),
    updatedAt: widget.updatedAt.toISOString(),
    videos: widget.widgetVideos.map(({ video }) => ({
      id: video.id,
      originalFilename: video.originalFilename,
      status: video.status,
      source: video.source,
      contentType: video.originalMimeType,
      durationMs: video.durationMs,
      width: video.width,
      height: video.height,
    })),
  };
}

async function requireWidget(
  shopId: string,
  widgetId: string,
  widgetRepository: Pick<WidgetRepository, "findByShop">,
): Promise<AdminWidgetRecord> {
  const widget = await widgetRepository.findByShop(shopId, validateWidgetId(widgetId));

  if (!widget) {
    throw new AdminWidgetExpectedError("Widget was not found", 404);
  }

  return widget;
}

function parseWidgetTitle(input: unknown): string {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AdminWidgetExpectedError("Request body must be an object", 400);
  }

  const title = (input as Record<string, unknown>).title;

  if (typeof title !== "string") {
    throw new AdminWidgetExpectedError("title is required", 400);
  }

  const trimmedTitle = title.trim().replace(/\s+/g, " ").slice(0, MAX_TITLE_LENGTH);

  if (!trimmedTitle) {
    throw new AdminWidgetExpectedError("title is required", 400);
  }

  return trimmedTitle;
}

function parseWidgetUpdate(input: unknown): { name?: string; status?: WidgetStatus } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AdminWidgetExpectedError("Request body must be an object", 400);
  }

  const record = input as Record<string, unknown>;
  const update: { name?: string; status?: WidgetStatus } = {};

  if ("title" in record) {
    update.name = parseWidgetTitle(input);
  }

  if ("status" in record) {
    if (typeof record.status !== "string" || !WIDGET_STATUSES.has(record.status as WidgetStatus)) {
      throw new AdminWidgetExpectedError("status is invalid", 400);
    }

    update.status = record.status as WidgetStatus;
  }

  if (!update.name && !update.status) {
    throw new AdminWidgetExpectedError("No supported widget fields were provided", 400);
  }

  return update;
}

function parseVideoIdInput(input: unknown): string {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AdminWidgetExpectedError("Request body must be an object", 400);
  }

  return validateVideoId((input as Record<string, unknown>).videoId);
}

function validateWidgetId(widgetId: string): string {
  if (!widgetId.trim() || widgetId.length > 160 || /[/"'<>\\\s]/.test(widgetId)) {
    throw new AdminWidgetExpectedError("widgetId is invalid", 400);
  }

  return widgetId;
}

function validateVideoId(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 160 || value.includes("/")) {
    throw new AdminWidgetExpectedError("videoId is invalid", 400);
  }

  return value;
}
