import { z } from "zod";

export const VideoSourceSchema = z.enum([
  "MANUAL_UPLOAD",
  "FUTURE_INSTAGRAM",
  "FUTURE_TIKTOK",
]);
export type VideoSource = z.infer<typeof VideoSourceSchema>;

export const ActiveVideoSourceSchema = z.literal("MANUAL_UPLOAD");
export type ActiveVideoSource = z.infer<typeof ActiveVideoSourceSchema>;

export const VideoStatusSchema = z.enum([
  "UPLOADED",
  "PROCESSING",
  "READY",
  "FAILED",
  "ARCHIVED",
]);
export type VideoStatus = z.infer<typeof VideoStatusSchema>;

export const WidgetStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export type WidgetStatus = z.infer<typeof WidgetStatusSchema>;

export const WidgetLayoutSchema = z.enum(["INLINE_CAROUSEL"]);
export type WidgetLayout = z.infer<typeof WidgetLayoutSchema>;

export const AnalyticsEventTypeSchema = z.enum([
  "WIDGET_VIEWED",
  "VIDEO_PLAYED",
  "VIDEO_COMPLETED",
  "PRODUCT_CLICKED",
  "ADD_TO_CART_CLICKED",
  "ADD_TO_CART_SUCCEEDED",
  "ADD_TO_CART_FAILED",
]);
export type AnalyticsEventType = z.infer<typeof AnalyticsEventTypeSchema>;

export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("shoppable-video-shopify-app"),
  version: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ShopDomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/, "Expected a myshopify.com shop domain");

export const WidgetSettingsSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  autoplay: z.boolean().default(false),
  showProductTray: z.boolean().default(true),
});
export type WidgetSettings = z.infer<typeof WidgetSettingsSchema>;
