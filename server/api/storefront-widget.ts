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
      productHandle: string | null;
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
  publicBaseUrl,
  shop,
  widgetId,
  widgetRepository,
}: {
  publicBaseUrl?: string;
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

  return toPublicStorefrontWidgetPayload(widget, { publicBaseUrl });
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
  if (!mountSelector) {
    const scriptParentTag = script.parentElement && script.parentElement.tagName ? script.parentElement.tagName.toLowerCase() : "";
    if (script.parentNode && scriptParentTag !== "head") {
      script.parentNode.insertBefore(mount, script.nextSibling);
    } else {
      const parent = document.body || document.documentElement;
      if (!parent) return;
      parent.appendChild(mount);
    }
  }
  mount.setAttribute("data-shoppable-video-widget", widgetId || "");
  const root = mount.attachShadow ? mount.attachShadow({ mode: "open" }) : mount;
  const setText = (node, value) => { node.textContent = value == null ? "" : String(value); };
  const renderStyles = () => {
    const style = document.createElement("style");
    style.textContent = [
      ":host{display:block;color:#111;font-family:inherit}",
      "*{box-sizing:border-box}",
      ".sv-widget{width:100%;margin:28px 0;padding:0}",
      ".sv-header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin:0 0 14px}",
      ".sv-title{font:inherit;font-size:24px;font-weight:700;line-height:1.2;margin:0;color:inherit}",
      ".sv-list{display:flex;gap:16px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;padding:2px 2px 12px}",
      ".sv-list::-webkit-scrollbar{height:8px}",
      ".sv-list::-webkit-scrollbar-thumb{background:rgba(0,0,0,.18);border-radius:999px}",
      ".sv-reel{position:relative;flex:0 0 230px;aspect-ratio:9/16;overflow:hidden;border-radius:18px;background:#111;box-shadow:0 8px 24px rgba(0,0,0,.14);scroll-snap-align:start}",
      ".sv-media{display:block;width:100%;height:100%;object-fit:cover;background:#111}",
      ".sv-placeholder{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center;background:linear-gradient(180deg,#2b2b2b,#111);color:#fff;font-size:14px;line-height:1.35}",
      ".sv-mute{position:absolute;top:10px;right:10px;z-index:2;min-width:74px;height:34px;border:0;border-radius:999px;background:rgba(255,255,255,.92);color:#111;font:inherit;font-size:13px;font-weight:650;line-height:1;box-shadow:0 4px 14px rgba(0,0,0,.16);cursor:pointer}",
      ".sv-products{position:absolute;left:10px;right:10px;bottom:10px;z-index:2;display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}",
      ".sv-product{display:block;width:100%;border:0;border-radius:12px;background:rgba(255,255,255,.94);color:#111;font:inherit;font-size:13px;font-weight:650;line-height:1.25;text-align:left;text-decoration:none;padding:10px 12px;box-shadow:0 4px 14px rgba(0,0,0,.18);cursor:pointer}",
      ".sv-empty{margin:0;color:rgba(0,0,0,.68);font-size:15px}",
      "@media (max-width:640px){.sv-widget{margin:22px 0}.sv-title{font-size:20px}.sv-list{gap:12px}.sv-reel{flex-basis:190px;border-radius:16px}}"
    ].join("");
    root.appendChild(style);
  };
  const renderMessage = (message) => {
    root.textContent = "";
    const container = document.createElement("div");
    container.setAttribute("role", "status");
    setText(container, message);
    root.appendChild(container);
  };
  if (!shop || !widgetId) {
    renderMessage("Shoppable video widget is unavailable.");
    return;
  }
  const endpoint = new URL("/api/storefront/widgets/" + encodeURIComponent(widgetId), script.src);
  const eventEndpoint = new URL("/api/storefront/events", script.src);
  endpoint.searchParams.set("shop", shop);
  const muteEventName = "shoppable-video:unmuted";
  const widgetMedia = [];
  const muteButtons = new WeakMap();
  const requestVideoPlay = (media) => {
    try {
      const playResult = media.play();
      if (playResult && typeof playResult.catch === "function") {
        playResult.catch(() => {});
      }
    } catch {}
  };
  const setMuteText = (button, media) => {
    setText(button, media.muted ? "Unmute" : "Mute");
    button.setAttribute("aria-label", media.muted ? "Unmute video" : "Mute video");
  };
  const setMediaMuted = (media, muted) => {
    media.muted = muted;
    if (muted) {
      media.setAttribute("muted", "");
    } else {
      media.removeAttribute("muted");
    }
    const button = muteButtons.get(media);
    if (button) {
      setMuteText(button, media);
    }
  };
  const muteAllExcept = (activeMedia) => {
    for (const media of widgetMedia) {
      if (media !== activeMedia) {
        setMediaMuted(media, true);
      }
    }
  };
  const announceUnmutedMedia = (media) => {
    try {
      window.dispatchEvent(new CustomEvent(muteEventName, { detail: { media } }));
    } catch {
      muteAllExcept(media);
    }
  };
  window.addEventListener(muteEventName, (event) => {
    const activeMedia = event && event.detail ? event.detail.media : undefined;
    muteAllExcept(activeMedia);
  });
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
        credentials: "omit",
        keepalive: true
      }).catch(() => {});
    } catch {}
  };
  const slugifyProductTitle = (title) => String(title || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  const getVariantNumericId = (variantId) => {
    const match = typeof variantId === "string" ? variantId.match(/\\/ProductVariant\\/([0-9]+)$/) : null;
    return match ? match[1] : "";
  };
  const getProductUrl = (tag) => {
    const handle = tag && tag.productHandle ? String(tag.productHandle) : slugifyProductTitle(tag && tag.productTitle);
    if (!handle) return "";
    const productUrl = new URL("/products/" + encodeURIComponent(handle), window.location.origin);
    const variantId = getVariantNumericId(tag && tag.variantId);
    if (variantId) {
      productUrl.searchParams.set("variant", variantId);
    }
    return productUrl.toString();
  };
  fetch(endpoint.toString(), { headers: { Accept: "application/json" }, credentials: "omit" })
    .then((response) => {
      if (!response.ok) throw new Error("widget unavailable");
      return response.json();
    })
    .then((payload) => {
      root.textContent = "";
      renderStyles();
      const container = document.createElement("section");
      container.className = "sv-widget";
      container.setAttribute("aria-label", "Shoppable videos");
      const header = document.createElement("div");
      header.className = "sv-header";
      const title = document.createElement("h2");
      title.className = "sv-title";
      setText(title, payload.widget && payload.widget.title ? payload.widget.title : "Shoppable videos");
      header.appendChild(title);
      container.appendChild(header);
      const list = document.createElement("div");
      list.className = "sv-list";
      const videos = Array.isArray(payload.videos) ? payload.videos : [];
      if (videos.length === 0) {
        const empty = document.createElement("p");
        empty.className = "sv-empty";
        setText(empty, "No shoppable videos are available.");
        list.appendChild(empty);
      }
      for (const video of videos) {
        const item = document.createElement("article");
        item.className = "sv-reel";
        const fallback = document.createElement("div");
        fallback.className = "sv-placeholder";
        setText(fallback, "Video preview is unavailable.");
        if (video.publicUrl) {
          const media = document.createElement("video");
          media.className = "sv-media";
          media.src = video.publicUrl;
          media.autoplay = true;
          media.controls = false;
          media.defaultMuted = true;
          media.loop = true;
          media.muted = true;
          media.preload = "auto";
          media.playsInline = true;
          media.setAttribute("autoplay", "");
          media.setAttribute("loop", "");
          media.setAttribute("muted", "");
          media.setAttribute("playsinline", "");
          const muteButton = document.createElement("button");
          muteButton.className = "sv-mute";
          muteButton.type = "button";
          muteButton.hidden = true;
          setMuteText(muteButton, media);
          muteButtons.set(media, muteButton);
          widgetMedia.push(media);
          media.addEventListener("play", () => sendEvent({ eventType: "VIDEO_PLAY", videoId: video.id }));
          media.addEventListener("pause", () => sendEvent({ eventType: "VIDEO_PAUSE", videoId: video.id }));
          media.addEventListener("canplay", () => {
            fallback.hidden = true;
            muteButton.hidden = false;
            requestVideoPlay(media);
          }, { once: true });
          media.addEventListener("error", () => {
            media.hidden = true;
            fallback.hidden = false;
            muteButton.hidden = true;
            setMediaMuted(media, true);
          });
          item.appendChild(media);
          fallback.hidden = true;
          item.appendChild(fallback);
          muteButton.addEventListener("click", () => {
            if (media.muted) {
              announceUnmutedMedia(media);
              setMediaMuted(media, false);
            } else {
              setMediaMuted(media, true);
            }
            requestVideoPlay(media);
          });
          item.appendChild(muteButton);
          setTimeout(() => requestVideoPlay(media), 0);
        } else {
          item.appendChild(fallback);
        }
        const tagList = document.createElement("ul");
        tagList.className = "sv-products";
        const tags = Array.isArray(video.tags) ? video.tags : [];
        for (const tag of tags) {
          const tagItem = document.createElement("li");
          const tagLink = document.createElement("a");
          const productUrl = getProductUrl(tag);
          tagLink.className = "sv-product";
          tagLink.href = productUrl || "#";
          setText(tagLink, [tag.productTitle, tag.variantTitle].filter(Boolean).join(" - "));
          tagLink.addEventListener("click", (event) => {
            if (!productUrl) {
              event.preventDefault();
            }
            sendEvent({
            eventType: "PRODUCT_CLICK",
            videoId: video.id,
            productId: tag.productId,
            variantId: tag.variantId
            });
          });
          tagItem.appendChild(tagLink);
          tagList.appendChild(tagItem);
        }
        item.appendChild(tagList);
        list.appendChild(item);
        sendEvent({ eventType: "VIDEO_IMPRESSION", videoId: video.id });
      }
      container.appendChild(list);
      root.appendChild(container);
      sendEvent({ eventType: "WIDGET_VIEW" });
    })
    .catch(() => renderMessage("Shoppable video widget is unavailable."));
})();`;
}

export function toPublicStorefrontWidgetPayload(
  widget: StorefrontWidgetRecord,
  options: {
    publicBaseUrl?: string;
  } = {},
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
        publicUrl:
          getPublicMediaUrl(video.playbackUrl, {
            publicBaseUrl: options.publicBaseUrl,
            shopDomain: widget.shop.shopDomain,
            widgetId: widget.id,
            videoId: video.id,
            hasOriginalStorageObject: Boolean(video.storageKeyOriginal),
          }) ?? null,
        tags: video.productTags
          .filter((tag) => tag.isActive)
          .map((tag) => ({
            productId: tag.shopifyProductId,
            variantId: tag.shopifyVariantId,
            productTitle: tag.productTitleSnapshot,
            productHandle: tag.productHandleSnapshot,
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

function getPublicMediaUrl(
  playbackUrl: string | null,
  {
    publicBaseUrl,
    shopDomain,
    widgetId,
    videoId,
    hasOriginalStorageObject,
  }: {
    publicBaseUrl?: string;
    shopDomain: string;
    widgetId: string;
    videoId: string;
    hasOriginalStorageObject: boolean;
  },
): string | null {
  if (isPublicMediaUrl(playbackUrl)) {
    return playbackUrl;
  }

  if (!publicBaseUrl || !hasOriginalStorageObject) {
    return null;
  }

  try {
    const url = new URL(
      `/api/storefront/widgets/${encodeURIComponent(widgetId)}/videos/${encodeURIComponent(videoId)}/media`,
      publicBaseUrl,
    );

    url.searchParams.set("shop", shopDomain);

    return url.toString();
  } catch {
    return null;
  }
}
