import {
  getShopifyIdToken,
  type AdminDashboardTokenProvider,
} from "./admin-shell";

export const ADMIN_PRODUCT_SEARCH_PATH = "/api/admin/products/search";
export const PRODUCT_SEARCH_SAFE_ERROR_MESSAGE =
  "We could not search Shopify products. Reload the app from Shopify admin.";

export type ProductSearchImage = {
  url: string;
  altText: string | null;
};

export type ProductSearchVariant = {
  id: string;
  title: string;
  sku: string | null;
  price: string;
  inventoryQuantity: number | null;
};

export type ProductSearchProduct = {
  id: string;
  title: string;
  handle: string;
  status: string;
  featuredImage: ProductSearchImage | null;
  variants: ProductSearchVariant[];
};

export type ProductSearchResult = {
  products: ProductSearchProduct[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
};

export type ProductSearchParams = {
  q?: string;
  first?: number;
  after?: string | null;
};

export type ProductSearchClient = (params: ProductSearchParams) => Promise<ProductSearchResult>;

export async function fetchAdminProductSearch(
  params: ProductSearchParams,
  fetcher: typeof fetch = fetch,
  tokenProvider: AdminDashboardTokenProvider = getShopifyIdToken,
): Promise<ProductSearchResult> {
  const headers = new Headers({
    Accept: "application/json",
  });
  const token = await safelyLoadProductSearchToken(tokenProvider);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetcher(toProductSearchUrl(params), {
    headers,
  });

  if (!response.ok) {
    throw new Error(PRODUCT_SEARCH_SAFE_ERROR_MESSAGE);
  }

  return (await response.json()) as ProductSearchResult;
}

function toProductSearchUrl({ q, first, after }: ProductSearchParams): string {
  const searchParams = new URLSearchParams();
  const trimmedQuery = q?.trim();

  if (trimmedQuery) {
    searchParams.set("q", trimmedQuery);
  }

  if (first !== undefined) {
    searchParams.set("first", String(first));
  }

  if (after) {
    searchParams.set("after", after);
  }

  const queryString = searchParams.toString();

  return queryString ? `${ADMIN_PRODUCT_SEARCH_PATH}?${queryString}` : ADMIN_PRODUCT_SEARCH_PATH;
}

async function safelyLoadProductSearchToken(
  tokenProvider: AdminDashboardTokenProvider,
): Promise<string | undefined> {
  try {
    return await tokenProvider();
  } catch {
    return undefined;
  }
}
