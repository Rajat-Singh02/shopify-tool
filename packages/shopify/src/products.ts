export const SHOPIFY_PRODUCT_SEARCH_QUERY = `#graphql
  query ShoppableVideoProductSearch($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
      edges {
        cursor
        node {
          id
          title
          handle
          status
          featuredImage {
            url
            altText
          }
          variants(first: 20) {
            nodes {
              id
              title
              sku
              price
              inventoryQuantity
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export type ProductSearchInput = {
  q?: string | null;
  first?: number | null;
  after?: string | null;
};

export type SanitizedProductSearchInput = {
  query?: string;
  first: number;
  after?: string;
};

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

export type ProductSearchResponse = {
  products: ProductSearchProduct[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
};

export type ShopifyProductGraphqlClient = {
  request<TData>(query: string, variables: Record<string, unknown>): Promise<TData>;
};

type ShopifyProductSearchGraphqlResponse = {
  products?: {
    edges?: Array<{
      cursor?: string | null;
      node?: {
        id?: string;
        title?: string;
        handle?: string;
        status?: string;
        featuredImage?: {
          url?: string;
          altText?: string | null;
        } | null;
        variants?: {
          nodes?: Array<{
            id?: string;
            title?: string;
            sku?: string | null;
            price?: string | number;
            inventoryQuantity?: number | null;
          } | null>;
        } | null;
      } | null;
    } | null>;
    pageInfo?: {
      hasNextPage?: boolean;
      endCursor?: string | null;
    };
  };
};

export class ShopifyProductSearchError extends Error {
  constructor(message = "Unable to search Shopify products") {
    super(message);
    this.name = "ShopifyProductSearchError";
  }
}

export function sanitizeProductSearchInput(input: ProductSearchInput): SanitizedProductSearchInput {
  return {
    query: sanitizeProductSearchQuery(input.q),
    first: sanitizeProductSearchFirst(input.first),
    after: sanitizeProductSearchCursor(input.after),
  };
}

export async function searchShopifyProducts(
  client: ShopifyProductGraphqlClient,
  input: ProductSearchInput,
): Promise<ProductSearchResponse> {
  const sanitizedInput = sanitizeProductSearchInput(input);
  const data = await client.request<ShopifyProductSearchGraphqlResponse>(
    SHOPIFY_PRODUCT_SEARCH_QUERY,
    {
      first: sanitizedInput.first,
      after: sanitizedInput.after ?? null,
      query: sanitizedInput.query ?? null,
    },
  );

  return mapShopifyProductSearchResponse(data);
}

export function mapShopifyProductSearchResponse(
  data: ShopifyProductSearchGraphqlResponse,
): ProductSearchResponse {
  const products = data.products?.edges?.flatMap((edge) => {
    const node = edge?.node;

    if (!node?.id || !node.title || !node.handle || !node.status) {
      return [];
    }

    return [
      {
        id: node.id,
        title: node.title,
        handle: node.handle,
        status: node.status,
        featuredImage: mapProductImage(node.featuredImage),
        variants: mapProductVariants(node.variants?.nodes ?? []),
      },
    ];
  }) ?? [];

  return {
    products,
    pageInfo: {
      hasNextPage: data.products?.pageInfo?.hasNextPage === true,
      endCursor: data.products?.pageInfo?.endCursor ?? null,
    },
  };
}

function mapProductImage(
  image:
    | {
        url?: string;
        altText?: string | null;
      }
    | null
    | undefined,
): ProductSearchImage | null {
  if (!image?.url) {
    return null;
  }

  return {
    url: image.url,
    altText: image.altText ?? null,
  };
}

function mapProductVariants(
  variants: Array<{
    id?: string;
    title?: string;
    sku?: string | null;
    price?: string | number;
    inventoryQuantity?: number | null;
  } | null>,
): ProductSearchVariant[] {
  return variants.flatMap((variant) => {
    if (!variant?.id || !variant.title || variant.price === undefined) {
      return [];
    }

    return [
      {
        id: variant.id,
        title: variant.title,
        sku: variant.sku ?? null,
        price: String(variant.price),
        inventoryQuantity: variant.inventoryQuantity ?? null,
      },
    ];
  });
}

function sanitizeProductSearchQuery(query: string | null | undefined): string | undefined {
  const sanitizedQuery = query
    ?.split("")
    .map((character) => (isControlCharacter(character) ? " " : character))
    .join("")
    .replace(/[\\"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  return sanitizedQuery ? sanitizedQuery : undefined;
}

function sanitizeProductSearchFirst(first: number | null | undefined): number {
  if (!Number.isFinite(first) || first === undefined || first === null) {
    return 20;
  }

  return Math.max(1, Math.min(50, Math.trunc(first)));
}

function sanitizeProductSearchCursor(cursor: string | null | undefined): string | undefined {
  const sanitizedCursor = cursor
    ?.split("")
    .filter((character) => !isControlCharacter(character))
    .join("")
    .trim()
    .slice(0, 500);

  return sanitizedCursor ? sanitizedCursor : undefined;
}

function isControlCharacter(character: string): boolean {
  const charCode = character.charCodeAt(0);

  return charCode <= 31 || charCode === 127;
}
