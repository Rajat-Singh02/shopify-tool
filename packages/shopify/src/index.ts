import { ApiVersion } from "@shopify/shopify-app-react-router/server";

export type ShopifyAdminSession = {
  shop: string;
  accessToken: string;
};

export type ShopifyGraphqlClient = {
  request<TData>(query: string, variables?: Record<string, unknown>): Promise<TData>;
};

export const SupportedShopifyApiVersion = {
  "2024-10": ApiVersion.October24,
  "2025-01": ApiVersion.January25,
  "2025-04": ApiVersion.April25,
  "2025-07": ApiVersion.July25,
  "2025-10": ApiVersion.October25,
  "2026-01": ApiVersion.January26,
  "2026-04": ApiVersion.April26,
  unstable: ApiVersion.Unstable,
} as const;

export type SupportedShopifyApiVersionKey = keyof typeof SupportedShopifyApiVersion;

export function toShopifyApiVersion(version: SupportedShopifyApiVersionKey): ApiVersion {
  return SupportedShopifyApiVersion[version];
}

export function parseShopifyScopes(scopes: string): string[] {
  return scopes
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export {
  ShopifyWebhookTopic,
  createWebhookPayloadHash,
  isAppUninstalledTopic,
  normalizeShopifyWebhookTopic,
  type ShopifyWebhookTopic as ShopifyWebhookTopicValue,
} from "./webhooks.js";

export {
  SHOPIFY_PRODUCT_SEARCH_QUERY,
  ShopifyProductSearchError,
  mapShopifyProductSearchResponse,
  sanitizeProductSearchInput,
  searchShopifyProducts,
  type ProductSearchImage,
  type ProductSearchInput,
  type ProductSearchProduct,
  type ProductSearchResponse,
  type ProductSearchVariant,
  type SanitizedProductSearchInput,
  type ShopifyProductGraphqlClient,
} from "./products.js";
