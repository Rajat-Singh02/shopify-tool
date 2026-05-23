import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  EmptyState,
  InlineStack,
  Page,
  Spinner,
  Text,
  TextField,
  Thumbnail,
} from "@shopify/polaris";
import { useCallback, useState } from "react";

import {
  fetchAdminProductSearch,
  PRODUCT_SEARCH_SAFE_ERROR_MESSAGE,
  type ProductSearchClient,
  type ProductSearchProduct,
  type ProductSearchResult,
} from "../services/product-search";

type ProductsPageProps = {
  searchProducts?: ProductSearchClient;
};

type ProductSearchState =
  | { status: "idle"; result: ProductSearchResult | null }
  | { status: "loading"; result: ProductSearchResult | null }
  | { status: "loading-more"; result: ProductSearchResult }
  | { status: "ready"; result: ProductSearchResult }
  | { status: "error"; result: ProductSearchResult | null; message: string };

export function ProductsPage({ searchProducts = fetchAdminProductSearch }: ProductsPageProps) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<ProductSearchState>({
    status: "idle",
    result: null,
  });
  const result = state.result;
  const isInitialLoading = state.status === "loading";
  const isLoadingMore = state.status === "loading-more";

  const runSearch = useCallback(
    async ({ after, append }: { after?: string | null; append?: boolean } = {}) => {
      const previousResult = state.result;

      setState(
        append && previousResult
          ? { status: "loading-more", result: previousResult }
          : { status: "loading", result: append ? previousResult : null },
      );

      try {
        const nextResult = await searchProducts({
          q: query,
          first: 20,
          after,
        });

        setState({
          status: "ready",
          result:
            append && previousResult
              ? {
                  products: [...previousResult.products, ...nextResult.products],
                  pageInfo: nextResult.pageInfo,
                }
              : nextResult,
        });
      } catch {
        setState({
          status: "error",
          result: previousResult,
          message: PRODUCT_SEARCH_SAFE_ERROR_MESSAGE,
        });
      }
    },
    [query, searchProducts, state.result],
  );

  return (
    <Page
      title="Products"
      subtitle="Search products and variants to prepare shoppable video tags"
    >
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="300">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void runSearch();
              }}
            >
              <InlineStack gap="300" blockAlign="end">
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Search products"
                    value={query}
                    onChange={setQuery}
                    autoComplete="off"
                    placeholder="Search by title, handle, or keyword"
                  />
                </div>
                <Button
                  variant="primary"
                  submit
                  loading={isInitialLoading}
                  disabled={isLoadingMore}
                >
                  Search
                </Button>
              </InlineStack>
            </form>
          </BlockStack>
        </Card>

        {state.status === "error" ? (
          <Banner tone="critical" title="Product search unavailable">
            {state.message}
          </Banner>
        ) : null}

        {isInitialLoading ? (
          <Card>
            <InlineStack gap="300" blockAlign="center">
              <Spinner accessibilityLabel="Searching products" size="small" />
              <Text as="p" tone="subdued">
                Searching products
              </Text>
            </InlineStack>
          </Card>
        ) : null}

        {result && result.products.length === 0 && state.status !== "loading" ? (
          <Card>
            <EmptyState
              heading="No products found"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Try another product title, handle, SKU, or keyword.</p>
            </EmptyState>
          </Card>
        ) : null}

        {result && result.products.length > 0 ? (
          <BlockStack gap="300">
            {result.products.map((product) => (
              <ProductSearchResultCard key={product.id} product={product} />
            ))}
            <InlineStack align="center">
              <Button
                onClick={() =>
                  void runSearch({
                    after: result.pageInfo.endCursor,
                    append: true,
                  })
                }
                loading={isLoadingMore}
                disabled={!result.pageInfo.hasNextPage || isInitialLoading}
              >
                Load more
              </Button>
            </InlineStack>
          </BlockStack>
        ) : null}
      </BlockStack>
    </Page>
  );
}

function ProductSearchResultCard({ product }: { product: ProductSearchProduct }) {
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack gap="300" blockAlign="center" align="space-between">
          <InlineStack gap="300" blockAlign="center">
            {product.featuredImage ? (
              <Thumbnail
                source={product.featuredImage.url}
                alt={product.featuredImage.altText ?? product.title}
                size="small"
              />
            ) : null}
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">
                {product.title}
              </Text>
              <Text as="p" tone="subdued">
                {product.handle}
              </Text>
            </BlockStack>
          </InlineStack>
          <Badge tone={product.status === "ACTIVE" ? "success" : "info"}>{product.status}</Badge>
        </InlineStack>

        <BlockStack gap="200">
          {product.variants.map((variant) => (
            <InlineStack key={variant.id} gap="300" align="space-between" blockAlign="center">
              <BlockStack gap="050">
                <Text as="p" fontWeight="medium">
                  {variant.title}
                </Text>
                <Text as="p" tone="subdued">
                  SKU: {variant.sku || "None"}
                </Text>
              </BlockStack>
              <InlineStack gap="300">
                <Text as="p">{variant.price}</Text>
                <Text as="p" tone="subdued">
                  Inventory: {variant.inventoryQuantity ?? "Unknown"}
                </Text>
              </InlineStack>
            </InlineStack>
          ))}
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
