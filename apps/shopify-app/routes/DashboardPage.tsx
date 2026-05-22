import { Badge, BlockStack, Card, Layout, Page, Text } from "@shopify/polaris";

import { getDashboardOverview } from "../services/dashboard.server";

export function DashboardPage() {
  const overview = getDashboardOverview();

  return (
    <Page title="Shoppable Video" subtitle="Manual-upload video commerce for Shopify">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Dashboard
              </Text>
              <Text as="p" tone="subdued">
                Uploads, tagging, widgets, and analytics will appear here as each v1 feature
                lands.
              </Text>
              <Badge tone="info">{overview.activeScopeLabel}</Badge>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
