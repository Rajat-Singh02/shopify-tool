-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "VideoSource" AS ENUM ('MANUAL_UPLOAD');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'READY', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WidgetStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WidgetLayout" AS ENUM ('INLINE_CAROUSEL');

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('WIDGET_VIEWED', 'VIDEO_PLAYED', 'VIDEO_COMPLETED', 'PRODUCT_CLICKED', 'ADD_TO_CART_CLICKED', 'ADD_TO_CART_SUCCEEDED', 'ADD_TO_CART_FAILED');

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "accessToken" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifySession" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "source" "VideoSource" NOT NULL DEFAULT 'MANUAL_UPLOAD',
    "originalFilename" TEXT NOT NULL,
    "originalMimeType" TEXT NOT NULL,
    "originalSizeBytes" BIGINT NOT NULL,
    "status" "VideoStatus" NOT NULL DEFAULT 'UPLOADED',
    "storageKeyOriginal" TEXT,
    "storageKeyOptimized" TEXT,
    "playbackUrl" TEXT,
    "thumbnailUrl" TEXT,
    "durationMs" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoProductTag" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "productTitleSnapshot" TEXT NOT NULL,
    "variantTitleSnapshot" TEXT,
    "productImageUrlSnapshot" TEXT,
    "priceSnapshot" DECIMAL(65,30),
    "currencyCodeSnapshot" TEXT,
    "position" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoProductTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Widget" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "WidgetStatus" NOT NULL DEFAULT 'DRAFT',
    "layout" "WidgetLayout" NOT NULL DEFAULT 'INLINE_CAROUSEL',
    "settingsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Widget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WidgetVideo" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "widgetId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WidgetVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "widgetId" TEXT,
    "videoId" TEXT,
    "tagId" TEXT,
    "eventType" "AnalyticsEventType" NOT NULL,
    "anonymousVisitorId" TEXT,
    "sessionId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" JSONB,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "shopId" TEXT,
    "topic" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadHash" TEXT NOT NULL,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopDomain_key" ON "Shop"("shopDomain");

-- CreateIndex
CREATE INDEX "ShopifySession_shop_idx" ON "ShopifySession"("shop");

-- CreateIndex
CREATE INDEX "Video_shopId_status_idx" ON "Video"("shopId", "status");

-- CreateIndex
CREATE INDEX "VideoProductTag_shopId_videoId_idx" ON "VideoProductTag"("shopId", "videoId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoProductTag_shopId_videoId_shopifyVariantId_key" ON "VideoProductTag"("shopId", "videoId", "shopifyVariantId");

-- CreateIndex
CREATE INDEX "Widget_shopId_status_idx" ON "Widget"("shopId", "status");

-- CreateIndex
CREATE INDEX "WidgetVideo_shopId_widgetId_idx" ON "WidgetVideo"("shopId", "widgetId");

-- CreateIndex
CREATE UNIQUE INDEX "WidgetVideo_shopId_widgetId_videoId_key" ON "WidgetVideo"("shopId", "widgetId", "videoId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_shopId_eventType_occurredAt_idx" ON "AnalyticsEvent"("shopId", "eventType", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDelivery_deliveryId_key" ON "WebhookDelivery"("deliveryId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_shopId_topic_idx" ON "WebhookDelivery"("shopId", "topic");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoProductTag" ADD CONSTRAINT "VideoProductTag_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoProductTag" ADD CONSTRAINT "VideoProductTag_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Widget" ADD CONSTRAINT "Widget_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WidgetVideo" ADD CONSTRAINT "WidgetVideo_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WidgetVideo" ADD CONSTRAINT "WidgetVideo_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "Widget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WidgetVideo" ADD CONSTRAINT "WidgetVideo_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "Widget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "VideoProductTag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

