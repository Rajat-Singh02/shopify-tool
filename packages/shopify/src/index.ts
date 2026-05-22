export type ShopifyAdminSession = {
  shop: string;
  accessToken: string;
};

export type ShopifyGraphqlClient = {
  request<TData>(query: string, variables?: Record<string, unknown>): Promise<TData>;
};
