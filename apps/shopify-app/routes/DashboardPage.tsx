import {
  Badge,
  Banner,
  BlockStack,
  Card,
  InlineStack,
  Layout,
  Page,
  SkeletonBodyText,
  Text,
} from "@shopify/polaris";

import type { AdminDashboardState } from "../services/admin-shell";

type DashboardPageProps = {
  dashboardState: AdminDashboardState;
};

export function DashboardPage({ dashboardState }: DashboardPageProps) {
  return (
    <Page title="Shoppable Video" subtitle="Manual-upload video commerce for Shopify">
      <Layout>
        <Layout.Section>
          {dashboardState.status === "loading" ? (
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Loading shop context
                </Text>
                <SkeletonBodyText lines={3} />
              </BlockStack>
            </Card>
          ) : null}

          {dashboardState.status === "error" ? (
            <Banner tone="critical" title="Shop context unavailable">
              {dashboardState.message}
            </Banner>
          ) : null}

          {dashboardState.status === "ready" ? (
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center" gap="300">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">
                      Connected shop
                    </Text>
                    <Text as="p" tone="subdued">
                      {dashboardState.data.shop.domain}
                    </Text>
                  </BlockStack>
                  <Badge tone="info">{dashboardState.data.overview.activeScopeLabel}</Badge>
                </InlineStack>
                <Text as="p" tone="subdued">
                  Uploads, tagging, widgets, and analytics will appear here as each v1 feature
                  lands.
                </Text>
              </BlockStack>
            </Card>
          ) : null}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
