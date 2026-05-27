import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  EmptyState,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  SkeletonBodyText,
  Text,
} from "@shopify/polaris";
import { useEffect, useMemo, useState } from "react";

import type { AdminDashboardState } from "../services/admin-shell";
import type { AdminWidget, AdminWidgetListClient } from "../services/admin-widgets";
import {
  fetchAdminVideoLibrary,
  formatVideoDuration,
  type VideoLibraryClient,
  type VideoLibraryItem,
} from "../services/video-library";
import { formatVideoFileSize } from "../services/video-upload";

type DashboardPageProps = {
  dashboardState: AdminDashboardState;
  loadWidgets?: AdminWidgetListClient;
  loadVideoLibrary?: VideoLibraryClient;
};

type DashboardSummaryState =
  | { status: "idle"; widgets: AdminWidget[]; videos: VideoLibraryItem[]; message?: undefined }
  | { status: "loading"; widgets: AdminWidget[]; videos: VideoLibraryItem[]; message?: undefined }
  | { status: "ready"; widgets: AdminWidget[]; videos: VideoLibraryItem[]; message?: undefined }
  | { status: "error"; widgets: AdminWidget[]; videos: VideoLibraryItem[]; message: string };

export function DashboardPage({
  dashboardState,
  loadWidgets,
  loadVideoLibrary = fetchAdminVideoLibrary,
}: DashboardPageProps) {
  const [summaryState, setSummaryState] = useState<DashboardSummaryState>({
    status: "idle",
    widgets: [],
    videos: [],
  });
  const canLoadSummary = dashboardState.status === "ready" && Boolean(loadWidgets);

  useEffect(() => {
    if (!canLoadSummary || !loadWidgets) {
      return undefined;
    }

    let isMounted = true;

    async function loadDashboardSummary() {
      await Promise.resolve();

      if (!isMounted) {
        return;
      }

      setSummaryState((currentState) => ({
        status: "loading",
        widgets: currentState.widgets,
        videos: currentState.videos,
      }));

      try {
        const [widgetResult, videoResult] = await Promise.all([
          loadWidgets?.(),
          loadVideoLibrary({
            first: 6,
            source: "MANUAL_UPLOAD",
          }),
        ]);

        if (isMounted && widgetResult) {
          setSummaryState({
            status: "ready",
            widgets: widgetResult.widgets,
            videos: videoResult.videos,
          });
        }
      } catch {
        if (isMounted) {
          setSummaryState((currentState) => ({
            status: "error",
            widgets: currentState.widgets,
            videos: currentState.videos,
            message: "We could not load the dashboard summary. Reload the app from Shopify admin.",
          }));
        }
      }
    }

    void loadDashboardSummary();

    return () => {
      isMounted = false;
    };
  }, [canLoadSummary, loadVideoLibrary, loadWidgets]);

  const readyVideos = useMemo(
    () => summaryState.videos.filter((video) => video.status === "READY"),
    [summaryState.videos],
  );
  const publishedWidgets = useMemo(
    () => summaryState.widgets.filter((widget) => widget.status === "PUBLISHED"),
    [summaryState.widgets],
  );

  return (
    <Page
      title="Shoppable Video"
      subtitle="Upload videos, tag products, publish widgets, and add them to your storefront"
      primaryAction={{ content: "Upload video", url: "/videos" }}
      secondaryActions={[{ content: "Create widget", url: "/widgets/new" }]}
    >
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
            <BlockStack gap="500">
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
                    Follow the four-step flow below to get a shoppable reel live without digging
                    through separate pages.
                  </Text>
                </BlockStack>
              </Card>

              {summaryState.status === "error" ? (
                <Banner tone="critical" title="Dashboard summary unavailable">
                  {summaryState.message}
                </Banner>
              ) : null}

              <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="300">
                <SetupStep
                  index={1}
                  title="Upload video"
                  state={summaryState.videos.length > 0 ? "Done" : "Start"}
                  actionLabel="Open videos"
                  actionUrl="/videos"
                />
                <SetupStep
                  index={2}
                  title="Tag product"
                  state={readyVideos.length > 0 ? "Ready" : "Waiting"}
                  actionLabel="Tag in video detail"
                  actionUrl="/videos"
                />
                <SetupStep
                  index={3}
                  title="Create widget"
                  state={summaryState.widgets.length > 0 ? "Done" : "Start"}
                  actionLabel="Create widget"
                  actionUrl="/widgets/new"
                />
                <SetupStep
                  index={4}
                  title="Add to storefront"
                  state={publishedWidgets.length > 0 ? "Ready" : "Waiting"}
                  actionLabel="Install widget"
                  actionUrl={publishedWidgets[0] ? `/widgets/${publishedWidgets[0].id}` : "/widgets"}
                />
              </InlineGrid>

              <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="300">
                <MetricCard label="Widgets" value={summaryState.widgets.length} />
                <MetricCard label="Published" value={publishedWidgets.length} />
                <MetricCard label="Videos" value={summaryState.videos.length} />
                <MetricCard label="Ready videos" value={readyVideos.length} />
              </InlineGrid>

              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingLg">
                    Widgets
                  </Text>
                  <Button url="/widgets">View all</Button>
                </InlineStack>
                {summaryState.status === "loading" ? <SkeletonBodyText lines={3} /> : null}
                {summaryState.status !== "loading" && summaryState.widgets.length === 0 ? (
                  <Card>
                    <EmptyState
                      heading="Create your first widget"
                      action={{ content: "Create widget", url: "/widgets/new" }}
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>Widgets group ready videos into storefront reels.</p>
                    </EmptyState>
                  </Card>
                ) : null}
                {summaryState.widgets.length > 0 ? (
                  <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="300">
                    {summaryState.widgets.slice(0, 6).map((widget) => (
                      <DashboardWidgetCard key={widget.id} widget={widget} />
                    ))}
                  </InlineGrid>
                ) : null}
              </BlockStack>

              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingLg">
                    Recent videos
                  </Text>
                  <Button url="/videos">Open library</Button>
                </InlineStack>
                {summaryState.videos.length > 0 ? (
                  <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="300">
                    {summaryState.videos.slice(0, 6).map((video) => (
                      <DashboardVideoCard key={video.id} video={video} />
                    ))}
                  </InlineGrid>
                ) : (
                  <Card>
                    <Text as="p" tone="subdued">
                      Upload a manual video to start building shoppable widgets.
                    </Text>
                  </Card>
                )}
              </BlockStack>
            </BlockStack>
          ) : null}
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function SetupStep({
  index,
  title,
  state,
  actionLabel,
  actionUrl,
}: {
  index: number;
  title: string;
  state: "Done" | "Ready" | "Start" | "Waiting";
  actionLabel: string;
  actionUrl: string;
}) {
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="span" fontWeight="bold">
            {index}
          </Text>
          <Badge tone={state === "Done" || state === "Ready" ? "success" : "info"}>{state}</Badge>
        </InlineStack>
        <Text as="h3" variant="headingMd">
          {title}
        </Text>
        <Button url={actionUrl}>{actionLabel}</Button>
      </BlockStack>
    </Card>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <BlockStack gap="100">
        <Text as="p" tone="subdued">
          {label}
        </Text>
        <Text as="p" variant="heading2xl">
          {value}
        </Text>
      </BlockStack>
    </Card>
  );
}

function DashboardWidgetCard({ widget }: { widget: AdminWidget }) {
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Badge tone={widget.status === "PUBLISHED" ? "success" : "info"}>{widget.status}</Badge>
          <Text as="span" tone="subdued">
            {widget.videos.length} videos
          </Text>
        </InlineStack>
        <BlockStack gap="100">
          <Text as="h3" variant="headingMd">
            {widget.title}
          </Text>
          <Text as="p" tone="subdued">
            Updated {formatDashboardDate(widget.updatedAt)}
          </Text>
        </BlockStack>
        <Button url={`/widgets/${widget.id}`}>Manage widget</Button>
      </BlockStack>
    </Card>
  );
}

function DashboardVideoCard({ video }: { video: VideoLibraryItem }) {
  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <Badge tone={video.status === "READY" ? "success" : "info"}>{video.status}</Badge>
          <Text as="span" tone="subdued">
            {formatVideoDuration(video.durationMs)}
          </Text>
        </InlineStack>
        <Text as="h3" variant="headingMd">
          {video.originalFilename}
        </Text>
        <Text as="p" tone="subdued">
          {video.contentType} · {formatVideoFileSize(video.sizeBytes)}
        </Text>
        <Button url={`/videos/${video.id}`}>View details</Button>
      </BlockStack>
    </Card>
  );
}

function formatDashboardDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
