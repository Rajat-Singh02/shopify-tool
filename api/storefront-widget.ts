import type {
  StorefrontWidgetRecord,
  WidgetRepository,
} from "@shoppable-video/db";

const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const MAX_SHOP_DOMAIN_LENGTH = 255;
const MAX_WIDGET_ID_LENGTH = 160;

export type PublicStorefrontWidgetPayload = {
  widget: {
    id: string;
    shopDomain: string;
    title: string;
    status: "PUBLISHED";
    layout: "INLINE_CAROUSEL";
  };
  videos: Array<{
    id: string;
    status: "READY";
    source: "MANUAL_UPLOAD";
    contentType: string;
    durationMs: number | null;
    width: number | null;
    height: number | null;
    publicUrl: string | null;
    tags: Array<{
      productId: string;
      variantId: string;
      productTitle: string;
      variantTitle: string | null;
      sku: string | null;
    }>;
  }>;
};

export class StorefrontWidgetExpectedError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly clientMessage = message,
  ) {
    super(message);
    this.name = "StorefrontWidgetExpectedError";
  }
}

export async function getStorefrontWidgetPayload({
  shop,
  widgetId,
  widgetRepository,
}: {
  shop: unknown;
  widgetId: string;
  widgetRepository: Pick<WidgetRepository, "findPublishedStorefrontWidget">;
}): Promise<PublicStorefrontWidgetPayload> {
  const shopDomain = validateShopDomain(shop);
  const safeWidgetId = validateWidgetId(widgetId);
  const widget = await widgetRepository.findPublishedStorefrontWidget(shopDomain, safeWidgetId);

  if (!widget) {
    throw new StorefrontWidgetExpectedError("Widget was not found", 404);
  }

  return toPublicStorefrontWidgetPayload(widget);
}

export function createStorefrontWidgetBootstrapScript(): string {
  return `(() => {
  const script = document.currentScript;
  if (!script) return;
  const shop = script.getAttribute("data-shop");
  const widgetId = script.getAttribute("data-widget-id");
  const mountSelector = script.getAttribute("data-mount");
  const mount = mountSelector ? document.querySelector(mountSelector) : document.createElement("div");
  if (!mount) return;
  if (!mountSelector && script.parentNode) script.parentNode.insertBefore(mount, script.nextSibling);
  mount.setAttribute("data-shoppable-video-widget", widgetId || "");
  const setText = (node, value) => { node.textContent = value == null ? "" : String(value); };
  const renderMessage = (message) => {
    mount.textContent = "";
    const container = document.createElement("div");
    container.setAttribute("role", "status");
    setText(container, message);
    mount.appendChild(container);
  };
  if (!shop || !widgetId) {
    renderMessage("Shoppable video widget is unavailable.");
    return;
  }
  const endpoint = new URL("/api/storefront/widgets/" + encodeURIComponent(widgetId), script.src);
  const eventEndpoint = new URL("/api/storefront/events", script.src);
  endpoint.searchParams.set("shop", shop);
  const sendEvent = (event) => {
    try {
      const body = JSON.stringify(Object.assign({ shop, widgetId, metadata: { source: "widget" } }, event));
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(eventEndpoint.toString(), blob);
        return;
      }
      fetch(eventEndpoint.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body,
        keepalive: true
      }).catch(() => {});
    } catch {}
  };
  fetch(endpoint.toString(), { headers: { Accept: "application/json" } })
    .then((response) => {
      if (!response.ok) throw new Error("widget unavailable");
      return response.json();
    })
    .then((payload) => {
      mount.textContent = "";
      const container = document.createElement("section");
      container.setAttribute("aria-label", "Shoppable videos");
      const title = document.createElement("h2");
      setText(title, payload.widget && payload.widget.title ? payload.widget.title : "Shoppable videos");
      container.appendChild(title);
      const list = document.createElement("div");
      const videos = Array.isArray(payload.videos) ? payload.videos : [];
      if (videos.length === 0) {
        const empty = document.createElement("p");
        setText(empty, "No shoppable videos are available.");
        list.appendChild(empty);
      }
      for (const video of videos) {
        const item = document.createElement("article");
        const label = document.createElement("p");
        setText(label, video.publicUrl ? "Shoppable video" : "Shoppable video preview unavailable");
        item.appendChild(label);
        if (video.publicUrl) {
          const media = document.createElement("video");
          media.src = video.publicUrl;
          media.controls = true;
          media.playsInline = true;
          media.addEventListener("play", () => sendEvent({ eventType: "VIDEO_PLAY", videoId: video.id }));
          media.addEventListener("pause", () => sendEvent({ eventType: "VIDEO_PAUSE", videoId: video.id }));
          item.appendChild(media);
        }
        const tagList = document.createElement("ul");
        const tags = Array.isArray(video.tags) ? video.tags : [];
        for (const tag of tags) {
          const tagItem = document.createElement("li");
          const tagButton = document.createElement("button");
          tagButton.type = "button";
          setText(tagButton, [tag.productTitle, tag.variantTitle].filter(Boolean).join(" - "));
          tagButton.addEventListener("click", () => sendEvent({
            eventType: "PRODUCT_CLICK",
            videoId: video.id,
            productId: tag.productId,
            variantId: tag.variantId
          }));
          tagItem.appendChild(tagButton);
          tagList.appendChild(tagItem);
        }
        item.appendChild(tagList);
        list.appendChild(item);
        sendEvent({ eventType: "VIDEO_IMPRESSION", videoId: video.id });
      }
      container.appendChild(list);
      mount.appendChild(container);
      sendEvent({ eventType: "WIDGET_VIEW" });
    })
    .catch(() => renderMessage("Shoppable video widget is unavailable."));
})();`;
}

export function toPublicStorefrontWidgetPayload(
  widget: StorefrontWidgetRecord,
): PublicStorefrontWidgetPayload {
  return {
    widget: {
      id: widget.id,
      shopDomain: widget.shop.shopDomain,
      title: widget.name,
      status: "PUBLISHED",
      layout: widget.layout,
    },
    videos: widget.widgetVideos
      .map((widgetVideo) => widgetVideo.video)
      .filter((video) => video.status === "READY")
      .map((video) => ({
        id: video.id,
        status: "READY",
        source: video.source,
        contentType: video.originalMimeType,
        durationMs: video.durationMs,
        width: video.width,
        height: video.height,
        publicUrl: isPublicMediaUrl(video.playbackUrl) ? video.playbackUrl : null,
        tags: video.productTags
          .filter((tag) => tag.isActive)
          .map((tag) => ({
            productId: tag.shopifyProductId,
            variantId: tag.shopifyVariantId,
            productTitle: tag.productTitleSnapshot,
            variantTitle: tag.variantTitleSnapshot,
            sku: null,
          })),
      })),
  };
}

function validateShopDomain(value: unknown): string {
  if (typeof value !== "string") {
    throw new StorefrontWidgetExpectedError("shop is required", 400);
  }

  const shopDomain = value.trim().toLowerCase();

  if (
    shopDomain.length === 0 ||
    shopDomain.length > MAX_SHOP_DOMAIN_LENGTH ||
    !SHOP_DOMAIN_PATTERN.test(shopDomain)
  ) {
    throw new StorefrontWidgetExpectedError("shop is invalid", 400);
  }

  return shopDomain;
}

function validateWidgetId(widgetId: string): string {
  const safeWidgetId = widgetId.trim();

  if (
    safeWidgetId.length === 0 ||
    safeWidgetId.length > MAX_WIDGET_ID_LENGTH ||
    /[/"'<>\\\s]/.test(safeWidgetId)
  ) {
    throw new StorefrontWidgetExpectedError("widgetId is invalid", 400);
  }

  return safeWidgetId;
}

function isPublicMediaUrl(value: string | null): value is string {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
