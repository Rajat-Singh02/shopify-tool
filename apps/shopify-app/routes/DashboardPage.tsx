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
  Modal,
  Page,
  ProgressBar,
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

const DASHBOARD_VIDEO_PAGE_SIZE = 5;
const SHOPIFY_CLIENT_ID = "507ec4018317a9c292eed04878307f58";
const APP_EMBED_HANDLE = "shoppable-video-app-embed";

type DashboardPageProps = {
  dashboardState: AdminDashboardState;
  loadWidgets?: AdminWidgetListClient;
  loadVideoLibrary?: VideoLibraryClient;
};

type DashboardVideoSummary = {
  totalCount: number;
  readyCount: number;
};

type DashboardSummaryState =
  | {
      status: "idle";
      widgets: AdminWidget[];
      videos: VideoLibraryItem[];
      videoSummary: DashboardVideoSummary;
      message?: undefined;
    }
  | {
      status: "loading";
      widgets: AdminWidget[];
      videos: VideoLibraryItem[];
      videoSummary: DashboardVideoSummary;
      message?: undefined;
    }
  | {
      status: "ready";
      widgets: AdminWidget[];
      videos: VideoLibraryItem[];
      videoSummary: DashboardVideoSummary;
      message?: undefined;
    }
  | {
      status: "error";
      widgets: AdminWidget[];
      videos: VideoLibraryItem[];
      videoSummary: DashboardVideoSummary;
      message: string;
    };

export function DashboardPage({
  dashboardState,
  loadWidgets,
  loadVideoLibrary = fetchAdminVideoLibrary,
}: DashboardPageProps) {
  const [summaryState, setSummaryState] = useState<DashboardSummaryState>({
    status: "idle",
    widgets: [],
    videos: [],
    videoSummary: {
      totalCount: 0,
      readyCount: 0,
    },
  });
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(false);
  const [setupStepIndex, setSetupStepIndex] = useState(0);
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
        videoSummary: currentState.videoSummary,
      }));

      try {
        const [widgetResult, videoResult] = await Promise.all([
          loadWidgets?.(),
          loadVideoLibrary({
            first: DASHBOARD_VIDEO_PAGE_SIZE,
            source: "MANUAL_UPLOAD",
          }),
        ]);

        if (isMounted && widgetResult) {
          const fallbackReadyCount = videoResult.videos.filter(
            (video) => video.status === "READY",
          ).length;

          setSummaryState({
            status: "ready",
            widgets: widgetResult.widgets,
            videos: videoResult.videos,
            videoSummary: {
              totalCount: videoResult.summary?.totalCount ?? videoResult.videos.length,
              readyCount: videoResult.summary?.readyCount ?? fallbackReadyCount,
            },
          });
        }
      } catch {
        if (isMounted) {
          setSummaryState((currentState) => ({
            status: "error",
            widgets: currentState.widgets,
            videos: currentState.videos,
            videoSummary: currentState.videoSummary,
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

  const publishedWidgets = useMemo(
    () => summaryState.widgets.filter((widget) => widget.status === "PUBLISHED"),
    [summaryState.widgets],
  );
  const totalVideoCount = summaryState.videoSummary.totalCount;
  const readyVideoCount = summaryState.videoSummary.readyCount;
  const themeEditorUrl =
    dashboardState.status === "ready"
      ? buildThemeEditorAppEmbedUrl(dashboardState.data.shop.domain)
      : undefined;
  const setupWizardStep = SETUP_WIZARD_STEPS[setupStepIndex];
  const setupProgress = Math.round(((setupStepIndex + 1) / SETUP_WIZARD_STEPS.length) * 100);

  return (
    <Page
      title="Shoppable Video"
      subtitle="Upload videos, tag products, publish widgets, and add them to your storefront"
      primaryAction={{ content: "Upload video", url: "/videos" }}
      secondaryActions={[
        { content: "See how it works", onAction: () => setIsSetupWizardOpen(true) },
        { content: "Create widget", url: "/widgets/new" },
      ]}
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
                  <InlineStack gap="300">
                    {themeEditorUrl ? (
                      <Button url={themeEditorUrl} target="_blank">
                        Enable app embed
                      </Button>
                    ) : null}
                    <Button onClick={() => setIsSetupWizardOpen(true)}>See how it works</Button>
                  </InlineStack>
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
                  state={totalVideoCount > 0 ? "Done" : "Start"}
                  actionLabel="Open videos"
                  actionUrl="/videos"
                />
                <SetupStep
                  index={2}
                  title="Tag product"
                  state={readyVideoCount > 0 ? "Ready" : "Waiting"}
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
                  actionLabel="Enable app embed"
                  actionUrl={themeEditorUrl ?? "/widgets"}
                  external={Boolean(themeEditorUrl)}
                />
              </InlineGrid>

              <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="300">
                <MetricCard label="Widgets" value={summaryState.widgets.length} />
                <MetricCard label="Published" value={publishedWidgets.length} />
                <MetricCard label="Videos" value={totalVideoCount} />
                <MetricCard label="Ready videos" value={readyVideoCount} />
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
                      <DashboardWidgetCard
                        key={widget.id}
                        widget={widget}
                        shopDomain={dashboardState.data.shop.domain}
                      />
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
      <Modal
        open={isSetupWizardOpen}
        onClose={() => setIsSetupWizardOpen(false)}
        title="See how it works"
        primaryAction={{
          content:
            setupStepIndex < SETUP_WIZARD_STEPS.length - 1
              ? "Next step"
              : (setupWizardStep?.actionLabel ?? "Finish"),
          onAction: () => {
            if (setupStepIndex < SETUP_WIZARD_STEPS.length - 1) {
              setSetupStepIndex((index) => index + 1);
              return;
            }

            setIsSetupWizardOpen(false);
          },
        }}
        secondaryActions={[
          {
            content: setupStepIndex === 0 ? "Close" : "Previous",
            onAction: () => {
              if (setupStepIndex === 0) {
                setIsSetupWizardOpen(false);
                return;
              }

              setSetupStepIndex((index) => Math.max(0, index - 1));
            },
          },
          ...(setupWizardStep?.actionUrl
            ? [
                {
                  content: setupWizardStep.actionLabel,
                  url:
                    setupWizardStep.kind === "app-embed" && themeEditorUrl
                      ? themeEditorUrl
                      : setupWizardStep.actionUrl,
                  external: setupWizardStep.kind === "app-embed",
                },
              ]
            : []),
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <ProgressBar progress={setupProgress} tone="primary" size="small" />
            <BlockStack gap="200">
              <Text as="p" tone="subdued">
                Step {setupStepIndex + 1} of {SETUP_WIZARD_STEPS.length}
              </Text>
              <Text as="h3" variant="headingMd">
                {setupWizardStep?.title}
              </Text>
              <Text as="p">{setupWizardStep?.description}</Text>
            </BlockStack>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

function SetupStep({
  index,
  title,
  state,
  actionLabel,
  actionUrl,
  external = false,
}: {
  index: number;
  title: string;
  state: "Done" | "Ready" | "Start" | "Waiting";
  actionLabel: string;
  actionUrl: string;
  external?: boolean;
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
        <Button url={actionUrl} target={external ? "_blank" : undefined}>
          {actionLabel}
        </Button>
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

function DashboardWidgetCard({ widget, shopDomain }: { widget: AdminWidget; shopDomain: string }) {
  const previewVideos = widget.videos.slice(0, 3);

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
        {previewVideos.length > 0 ? (
          <InlineStack gap="200" wrap={false}>
            {previewVideos.map((video) => (
              <DashboardWidgetVideoPreview
                key={video.id}
                widget={widget}
                video={video}
                shopDomain={shopDomain}
              />
            ))}
          </InlineStack>
        ) : (
          <div className="DashboardWidgetPreview DashboardWidgetPreview--empty">
            <Text as="p" tone="subdued">
              No videos attached yet
            </Text>
          </div>
        )}
        <Button url={`/widgets/${widget.id}`}>Manage widget</Button>
      </BlockStack>
    </Card>
  );
}

function DashboardWidgetVideoPreview({
  widget,
  video,
  shopDomain,
}: {
  widget: AdminWidget;
  video: VideoLibraryItem;
  shopDomain: string;
}) {
  const canPreviewMedia = widget.status === "PUBLISHED" && video.status === "READY";
  const mediaUrl = canPreviewMedia
    ? `/api/storefront/widgets/${encodeURIComponent(widget.id)}/videos/${encodeURIComponent(
        video.id,
      )}/media?shop=${encodeURIComponent(shopDomain)}`
    : undefined;

  return (
    <div className="DashboardWidgetPreview" title={video.originalFilename}>
      {mediaUrl ? (
        <video
          className="DashboardWidgetPreview__media"
          src={mediaUrl}
          muted
          playsInline
          preload="metadata"
        />
      ) : null}
      <div className="DashboardWidgetPreview__overlay">
        <Badge tone={video.status === "READY" ? "success" : "info"}>{video.status}</Badge>
        <Text as="span" variant="bodySm">
          {video.originalFilename}
        </Text>
      </div>
    </div>
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

type SetupWizardStep = {
  title: string;
  description: string;
  actionLabel: string;
  actionUrl: string;
  kind?: "app-embed";
};

const SETUP_WIZARD_STEPS: SetupWizardStep[] = [
  {
    title: "Upload one short product video",
    description:
      "Go to Videos, upload an MP4, and wait for it to become Ready. Ready is the safety gate before a video can appear on a storefront widget.",
    actionLabel: "Open videos",
    actionUrl: "/videos",
  },
  {
    title: "Tag the product variant",
    description:
      "Open the video detail page, search for the Shopify product, and attach the variant that should open when shoppers tap the product card.",
    actionLabel: "Open videos",
    actionUrl: "/videos",
  },
  {
    title: "Create and publish a widget",
    description:
      "Create a widget, attach Ready videos from the inline grid, then publish it. Draft widgets are kept out of the storefront.",
    actionLabel: "Create widget",
    actionUrl: "/widgets/new",
  },
  {
    title: "Enable the app embed",
    description:
      "Open the theme editor, enable the Shoppable Video app embed, and paste the widget IDs you want to render. This is the smooth path for multiple storefront placements.",
    actionLabel: "Enable app embed",
    actionUrl: "/widgets",
    kind: "app-embed",
  },
];

function buildThemeEditorAppEmbedUrl(shopDomain: string): string {
  const storeHandle = shopDomain.replace(/\.myshopify\.com$/i, "");
  const activateAppId = `${SHOPIFY_CLIENT_ID}/${APP_EMBED_HANDLE}`;

  return `https://admin.shopify.com/store/${encodeURIComponent(
    storeHandle,
  )}/themes/current/editor?context=apps&activateAppId=${encodeURIComponent(activateAppId)}`;
}
