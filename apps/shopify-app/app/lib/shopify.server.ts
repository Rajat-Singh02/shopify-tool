import {
  AppDistribution,
  shopifyApp,
  type Session,
} from "@shopify/shopify-app-react-router/server";
import { getPrismaClient, PrismaShopifySessionStorage, ShopRepository } from "@shoppable-video/db";
import { parseShopifyScopes, toShopifyApiVersion } from "@shoppable-video/shopify";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";

import { parseEnv, type AppEnv } from "../../lib/env";
import { ensureShopForSession } from "../../services/shop-lifecycle.server";

type AfterAuthHandler = (session: Session) => Promise<void>;

export type ShopifyServerDependencies = {
  env: AppEnv;
  sessionStorage: SessionStorage;
  afterAuth?: AfterAuthHandler;
};

export function createShopifyServerConfig({ env, sessionStorage, afterAuth }: ShopifyServerDependencies) {
  return {
    apiKey: env.SHOPIFY_API_KEY,
    apiSecretKey: env.SHOPIFY_API_SECRET,
    apiVersion: toShopifyApiVersion(env.SHOPIFY_API_VERSION),
    appUrl: env.SHOPIFY_APP_URL,
    scopes: parseShopifyScopes(env.SHOPIFY_SCOPES),
    sessionStorage,
    distribution: AppDistribution.AppStore,
    authPathPrefix: "/auth",
    useOnlineTokens: false,
    hooks: {
      afterAuth: async ({ session }: { session: Session }) => {
        await afterAuth?.(session);
      },
    },
  };
}

export function createShopifyServer(dependencies: ShopifyServerDependencies) {
  return shopifyApp(createShopifyServerConfig(dependencies));
}

let shopifyServer: ReturnType<typeof createShopifyServer> | undefined;

export function getShopifyServer() {
  if (!shopifyServer) {
    const prisma = getPrismaClient();
    const sessionStorage = new PrismaShopifySessionStorage(prisma);
    const shopRepository = new ShopRepository(prisma);

    shopifyServer = createShopifyServer({
      env: parseEnv(process.env),
      sessionStorage,
      afterAuth: async (session) => {
        await ensureShopForSession(session, { shopRepository });
      },
    });
  }

  return shopifyServer;
}

export function getSessionStorage(): SessionStorage {
  return getShopifyServer().sessionStorage;
}

export const authenticate = {
  admin(request: Request) {
    return getShopifyServer().authenticate.admin(request);
  },
};
