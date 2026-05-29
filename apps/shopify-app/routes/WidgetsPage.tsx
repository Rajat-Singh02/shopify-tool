import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  EmptyState,
  InlineGrid,
  InlineStack,
  Modal,
  Page,
  Spinner,
  Text,
  TextField,
} from "@shopify/polaris";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import {
  ADMIN_WIDGETS_SAFE_ERROR_MESSAGE,
  attachAdminWidgetVideo,
  createAdminWidget,
  detachAdminWidgetVideo,
  fetchAdminWidgetDetail,
  fetchAdminWidgets,
  updateAdminWidget,
  type AdminWidget,
  type AdminWidgetAttachVideoClient,
  type AdminWidgetCreateClient,
  type AdminWidgetDetachVideoClient,
  type AdminWidgetDetailClient,
  type AdminWidgetListClient,
  type AdminWidgetStatus,
  type AdminWidgetUpdateClient,
} from "../services/admin-widgets";
import {
  fetchAdminVideoLibrary,
  formatVideoDuration,
  type VideoLibraryClient,
  type VideoLibraryItem,
  type VideoLibraryStatus,
} from "../services/video-library";
import { formatVideoFileSize } from "../services/video-upload";

type WidgetsPageProps = {
  shopDomain?: string;
  loadWidgets?: AdminWidgetListClient;
  createWidget?: AdminWidgetCreateClient;
  loadWidgetDetail?: AdminWidgetDetailClient;
  updateWidget?: AdminWidgetUpdateClient;
  attachVideo?: AdminWidgetAttachVideoClient;
  detachVideo?: AdminWidgetDetachVideoClient;
  loadVideoLibrary?: VideoLibraryClient;
};

type WidgetListState =
  | { status: "loading"; widgets: AdminWidget[]; message?: undefined }
  | { status: "ready"; widgets: AdminWidget[]; message?: undefined }
  | { status: "error"; widgets: AdminWidget[]; message: string };

type WidgetDetailState =
  | { status: "idle"; widget: AdminWidget | null; message?: undefined }
  | { status: "loading"; widget: AdminWidget | null; message?: undefined }
  | { status: "ready"; widget: AdminWidget; message?: undefined }
  | { status: "error"; widget: AdminWidget | null; message: string };

type ReadyVideosState =
  | { status: "idle"; videos: VideoLibraryItem[]; message?: undefined }
  | { status: "loading"; videos: VideoLibraryItem[]; message?: undefined }
  | { status: "ready"; videos: VideoLibraryItem[]; message?: undefined }
  | { status: "error"; videos: VideoLibraryItem[]; message: string };

export function WidgetsPage({
  shopDomain,
  loadWidgets = fetchAdminWidgets,
  createWidget = createAdminWidget,
  loadWidgetDetail = fetchAdminWidgetDetail,
  updateWidget = updateAdminWidget,
  attachVideo = attachAdminWidgetVideo,
  detachVideo = detachAdminWidgetVideo,
  loadVideoLibrary = fetchAdminVideoLibrary,
}: WidgetsPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const routeSegment = getWidgetRouteSegment(location.pathname);
  const isCreateRoute = routeSegment === "new";
  const detailWidgetId = routeSegment && routeSegment !== "new" ? routeSegment : null;
  const [listState, setListState] = useState<WidgetListState>({
    status: "loading",
    widgets: [],
  });
  const [detailState, setDetailState] = useState<WidgetDetailState>({
    status: "idle",
    widget: null,
  });
  const [readyVideosState, setReadyVideosState] = useState<ReadyVideosState>({
    status: "idle",
    videos: [],
  });
  const [title, setTitle] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [attachingVideoId, setAttachingVideoId] = useState<string | null>(null);
  const [detachingVideoId, setDetachingVideoId] = useState<string | null>(null);
  const [detachingVideo, setDetachingVideo] = useState<VideoLibraryItem | null>(null);
  const [snippetCopied, setSnippetCopied] = useState(false);
  const [widgetIdCopied, setWidgetIdCopied] = useState(false);
  const selectedWidget = detailState.widget;
  const selectedVideoIds = useMemo(
    () => new Set(selectedWidget?.videos.map((video) => video.id) ?? []),
    [selectedWidget],
  );
  const readyManualVideos = useMemo(
    () => readyVideosState.videos.filter((video) => video.status === "READY"),
    [readyVideosState.videos],
  );
  const unavailableManualVideos = useMemo(
    () =>
      readyVideosState.videos.filter(
        (video) => video.status !== "READY" && video.status !== "ARCHIVED",
      ),
    [readyVideosState.videos],
  );
  const widgetScriptUrl = useMemo(() => getWidgetScriptUrl(), []);
  const embedSnippet = selectedWidget
    ? `<script src="${widgetScriptUrl}" data-shop="${
        shopDomain ?? "SHOP_DOMAIN"
      }" data-widget-id="${selectedWidget.id}"></script>`
    : "";

  const refreshWidgetList = useCallback(async () => {
    await Promise.resolve();

    setListState((currentState) => ({
      status: "loading",
      widgets: currentState.widgets,
    }));

    try {
      const result = await loadWidgets();
      setListState({ status: "ready", widgets: result.widgets });
    } catch {
      setListState((currentState) => ({
        status: "error",
        widgets: currentState.widgets,
        message: ADMIN_WIDGETS_SAFE_ERROR_MESSAGE,
      }));
    }
  }, [loadWidgets]);

  const loadReadyVideos = useCallback(async () => {
    setReadyVideosState((currentState) => ({
      status: "loading",
      videos: currentState.videos,
    }));

    try {
      const result = await loadVideoLibrary({
        first: 50,
        source: "MANUAL_UPLOAD",
      });

      setReadyVideosState({ status: "ready", videos: result.videos });
    } catch {
      setReadyVideosState((currentState) => ({
        status: "error",
        videos: currentState.videos,
        message: "We could not load videos for this widget.",
      }));
    }
  }, [loadVideoLibrary]);

  const loadWidget = useCallback(
    async (widgetId: string) => {
      await Promise.resolve();

      setDetailState((currentState) => ({
        status: "loading",
        widget: currentState.widget,
      }));
      setActionMessage(null);

      try {
        const widget = await loadWidgetDetail(widgetId);

        setDetailState({ status: "ready", widget });
        setEditTitle(widget.title);
        setSnippetCopied(false);
        setWidgetIdCopied(false);
        await loadReadyVideos();
      } catch {
        setDetailState((currentState) => ({
          status: "error",
          widget: currentState.widget,
          message: ADMIN_WIDGETS_SAFE_ERROR_MESSAGE,
        }));
      }
    },
    [loadReadyVideos, loadWidgetDetail],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshWidgetList();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshWidgetList]);

  useEffect(() => {
    let isMounted = true;

    const timeoutId = window.setTimeout(() => {
      if (!isMounted) {
        return;
      }

      if (detailWidgetId) {
        void loadWidget(detailWidgetId);
      } else {
        setDetailState({ status: "idle", widget: null });
        setReadyVideosState({ status: "idle", videos: [] });
        setActionMessage(null);
      }
    }, 0);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [detailWidgetId, loadWidget]);

  async function handleCreateWidget() {
    if (!title.trim()) {
      setActionMessage("Widget title is required.");
      return;
    }

    try {
      setIsCreating(true);
      setActionMessage(null);
      const widget = await createWidget({ title });

      setTitle("");
      setListState((currentState) => ({
        status: "ready",
        widgets: [widget, ...currentState.widgets.filter((item) => item.id !== widget.id)],
      }));
      void navigate(`/widgets/${widget.id}`);
    } catch {
      setActionMessage(ADMIN_WIDGETS_SAFE_ERROR_MESSAGE);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSaveTitle() {
    if (!selectedWidget || !editTitle.trim()) {
      return;
    }

    await updateSelectedWidget({ title: editTitle });
  }

  async function handleSetWidgetStatus(status: AdminWidgetStatus) {
    if (!selectedWidget) {
      return;
    }

    await updateSelectedWidget({ status });
  }

  async function updateSelectedWidget(input: { title?: string; status?: AdminWidgetStatus }) {
    if (!selectedWidget) {
      return;
    }

    try {
      setIsUpdating(true);
      setActionMessage(null);
      const widget = await updateWidget(selectedWidget.id, input);

      replaceWidget(widget);
      setDetailState({ status: "ready", widget });
      setEditTitle(widget.title);
    } catch {
      setActionMessage(ADMIN_WIDGETS_SAFE_ERROR_MESSAGE);
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleAttachVideo(videoId: string) {
    if (!selectedWidget) {
      return;
    }

    try {
      setAttachingVideoId(videoId);
      setActionMessage(null);
      const widget = await attachVideo(selectedWidget.id, videoId);

      replaceWidget(widget);
      setDetailState({ status: "ready", widget });
    } catch {
      setActionMessage(ADMIN_WIDGETS_SAFE_ERROR_MESSAGE);
    } finally {
      setAttachingVideoId(null);
    }
  }

  async function handleDetachVideo(video: VideoLibraryItem) {
    if (!selectedWidget) {
      return;
    }

    try {
      setDetachingVideoId(video.id);
      setActionMessage(null);
      await detachVideo(selectedWidget.id, video.id);
      const widget = await loadWidgetDetail(selectedWidget.id);

      replaceWidget(widget);
      setDetailState({ status: "ready", widget });
      setDetachingVideo(null);
    } catch {
      setActionMessage(ADMIN_WIDGETS_SAFE_ERROR_MESSAGE);
    } finally {
      setDetachingVideoId(null);
    }
  }

  async function handleCopySnippet() {
    if (!embedSnippet || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(embedSnippet);
    setSnippetCopied(true);
  }

  async function handleCopyWidgetId() {
    if (!selectedWidget || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(selectedWidget.id);
    setWidgetIdCopied(true);
  }

  function replaceWidget(widget: AdminWidget) {
    setListState((currentState) => ({
      status: "ready",
      widgets: currentState.widgets.map((item) => (item.id === widget.id ? widget : item)),
    }));
  }

  if (isCreateRoute) {
    return (
      <Page
        title="Create widget"
        subtitle="Start a new shoppable video placement"
        backAction={{ content: "Widgets", url: "/widgets" }}
      >
        <BlockStack gap="400">
          {actionMessage ? (
            <Banner tone="critical" title="Widget action unavailable">
              {actionMessage}
            </Banner>
          ) : null}
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Name the widget
              </Text>
              <TextField
                label="Widget title"
                value={title}
                onChange={setTitle}
                autoComplete="off"
                placeholder="Homepage video carousel"
              />
              <InlineStack>
                <Button
                  variant="primary"
                  onClick={() => void handleCreateWidget()}
                  loading={isCreating}
                  disabled={!title.trim() || isCreating}
                >
                  Create widget
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </BlockStack>
      </Page>
    );
  }

  if (detailWidgetId) {
    return (
      <Page
        title={selectedWidget?.title ?? "Widget details"}
        subtitle="Attach ready videos, publish, and install on the storefront"
        backAction={{ content: "Widgets", url: "/widgets" }}
      >
        <BlockStack gap="400">
          {detailState.status === "error" ? (
            <Banner tone="critical" title="Widget unavailable">
              {detailState.message}
            </Banner>
          ) : null}

          {actionMessage ? (
            <Banner tone="critical" title="Widget action unavailable">
              {actionMessage}
            </Banner>
          ) : null}

          {detailState.status === "loading" ? (
            <Card>
              <InlineStack gap="300" blockAlign="center">
                <Spinner accessibilityLabel="Loading widget" size="small" />
                <Text as="p" tone="subdued">
                  Loading widget
                </Text>
              </InlineStack>
            </Card>
          ) : null}

          {selectedWidget ? (
            <>
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="start">
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">
                        Widget setup
                      </Text>
                      <Text as="p" tone="subdued">
                        {selectedWidget.videos.length} attached videos · Updated{" "}
                        {formatWidgetDate(selectedWidget.updatedAt)}
                      </Text>
                    </BlockStack>
                    <Badge tone={toWidgetStatusTone(selectedWidget.status)}>
                      {selectedWidget.status}
                    </Badge>
                  </InlineStack>

                  <TextField
                    label="Widget title"
                    value={editTitle}
                    onChange={setEditTitle}
                    autoComplete="off"
                  />

                  <InlineStack gap="300">
                    <Button
                      variant="primary"
                      onClick={() => void handleSaveTitle()}
                      loading={isUpdating}
                      disabled={!editTitle.trim() || isUpdating}
                    >
                      Save title
                    </Button>
                    {selectedWidget.status !== "PUBLISHED" ? (
                      <Button
                        onClick={() => void handleSetWidgetStatus("PUBLISHED")}
                        loading={isUpdating}
                        disabled={selectedWidget.videos.length === 0}
                      >
                        Publish
                      </Button>
                    ) : (
                      <Button
                        onClick={() => void handleSetWidgetStatus("DRAFT")}
                        loading={isUpdating}
                      >
                        Unpublish
                      </Button>
                    )}
                    <Button
                      tone="critical"
                      onClick={() => void handleSetWidgetStatus("ARCHIVED")}
                      loading={isUpdating}
                      disabled={selectedWidget.status === "ARCHIVED"}
                    >
                      Archive
                    </Button>
                  </InlineStack>

                  {selectedWidget.videos.length === 0 ? (
                    <Banner tone="info" title="Attach at least one ready video">
                      Widgets can be published after they have ready videos attached.
                    </Banner>
                  ) : null}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Attached videos
                    </Text>
                    <Button onClick={() => void loadReadyVideos()}>
                      Refresh available videos
                    </Button>
                  </InlineStack>

                  {selectedWidget.videos.length === 0 ? (
                    <Text as="p" tone="subdued">
                      No videos are attached to this widget yet.
                    </Text>
                  ) : (
                    <BlockStack gap="200">
                      {selectedWidget.videos.map((video) => (
                        <AttachedVideoRow
                          key={video.id}
                          video={video}
                          isDetaching={detachingVideoId === video.id}
                          onDetach={() => setDetachingVideo(video)}
                        />
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">
                      Add ready videos
                    </Text>
                    <Text as="p" tone="subdued">
                      Only READY manual-upload videos can be attached to storefront widgets.
                    </Text>
                  </BlockStack>

                  {readyVideosState.status === "error" ? (
                    <Banner tone="critical" title="Videos unavailable">
                      {readyVideosState.message}
                    </Banner>
                  ) : null}
                  {readyVideosState.status === "loading" ? (
                    <InlineStack gap="300" blockAlign="center">
                      <Spinner accessibilityLabel="Loading ready videos" size="small" />
                      <Text as="p" tone="subdued">
                        Loading videos
                      </Text>
                    </InlineStack>
                  ) : null}

                  {readyManualVideos.length > 0 ? (
                    <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="300">
                      {readyManualVideos.map((video) => (
                        <ReadyVideoCard
                          key={video.id}
                          video={video}
                          isAttached={selectedVideoIds.has(video.id)}
                          isAttaching={attachingVideoId === video.id}
                          onAttach={() => void handleAttachVideo(video.id)}
                        />
                      ))}
                    </InlineGrid>
                  ) : null}

                  {readyManualVideos.length === 0 && readyVideosState.status !== "loading" ? (
                    <EmptyState
                      heading="No ready videos available"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>Upload videos, wait for processing, then tag products before attaching.</p>
                      <Button url="/videos">Open video library</Button>
                    </EmptyState>
                  ) : null}

                  {unavailableManualVideos.length > 0 ? (
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingSm">
                        Uploaded videos not ready yet
                      </Text>
                      {unavailableManualVideos.slice(0, 4).map((video) => (
                        <UnavailableVideoRow key={video.id} video={video} />
                      ))}
                    </BlockStack>
                  ) : null}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Install on storefront
                  </Text>
                  <Banner tone="info" title="Recommended: use the theme app embed">
                    Enable the Shoppable Video app embed in the theme editor, then paste widget IDs
                    there to render one or many widgets without adding multiple Custom Liquid
                    sections.
                  </Banner>
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="span" fontWeight="medium">
                      Widget ID:
                    </Text>
                    <Text as="span">{selectedWidget.id}</Text>
                    <Button onClick={() => void handleCopyWidgetId()} disabled={!navigator.clipboard}>
                      Copy widget ID
                    </Button>
                    {widgetIdCopied ? (
                      <Text as="span" tone="success">
                        Copied
                      </Text>
                    ) : null}
                  </InlineStack>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">
                      Fallback snippet
                    </Text>
                    <Text as="p" tone="subdued">
                      Use this only while the app embed is not installed in the theme.
                    </Text>
                    <pre aria-label="Widget embed snippet">{embedSnippet}</pre>
                    <InlineStack gap="200" blockAlign="center">
                      <Button onClick={() => void handleCopySnippet()} disabled={!navigator.clipboard}>
                        Copy fallback snippet
                      </Button>
                      {snippetCopied ? (
                        <Text as="span" tone="success">
                          Snippet copied
                        </Text>
                      ) : null}
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>
            </>
          ) : null}
        </BlockStack>

        <Modal
          open={detachingVideo !== null}
          onClose={() => {
            if (detachingVideoId === null) {
              setDetachingVideo(null);
            }
          }}
          title="Detach video?"
          primaryAction={{
            content: "Detach",
            destructive: true,
            loading: detachingVideo !== null && detachingVideoId === detachingVideo.id,
            onAction: () => {
              if (detachingVideo) {
                void handleDetachVideo(detachingVideo);
              }
            },
          }}
          secondaryActions={[
            {
              content: "Cancel",
              disabled: detachingVideoId !== null,
              onAction: () => setDetachingVideo(null),
            },
          ]}
        >
          <Modal.Section>
            <Text as="p">
              Remove {detachingVideo?.originalFilename ?? "this video"} from this widget?
            </Text>
          </Modal.Section>
        </Modal>
      </Page>
    );
  }

  return (
    <Page
      title="Widgets"
      subtitle="Create storefront placements and attach ready videos"
      primaryAction={{
        content: "Create widget",
        url: "/widgets/new",
      }}
    >
      <BlockStack gap="400">
        {listState.status === "error" ? (
          <Banner tone="critical" title="Widgets unavailable">
            {listState.message}
          </Banner>
        ) : null}

        {listState.status === "loading" ? (
          <Card>
            <InlineStack gap="300" blockAlign="center">
              <Spinner accessibilityLabel="Loading widgets" size="small" />
              <Text as="p" tone="subdued">
                Loading widgets
              </Text>
            </InlineStack>
          </Card>
        ) : null}

        {listState.widgets.length === 0 && listState.status !== "loading" ? (
          <Card>
            <EmptyState
              heading="Create your first widget"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Widgets collect ready videos into carousel placements for the storefront.</p>
              <Button variant="primary" url="/widgets/new">
                Create widget
              </Button>
            </EmptyState>
          </Card>
        ) : null}

        {listState.widgets.length > 0 ? (
          <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="300">
            {listState.widgets.map((widget) => (
              <WidgetSummaryCard key={widget.id} widget={widget} />
            ))}
          </InlineGrid>
        ) : null}
      </BlockStack>
    </Page>
  );
}

function getWidgetRouteSegment(pathname: string): string | null {
  const [, root, segment] = pathname.split("/");

  return root === "widgets" ? segment || null : null;
}

function getWidgetScriptUrl(): string {
  if (typeof window === "undefined") {
    return "/widget.js";
  }

  return `${window.location.origin}/widget.js`;
}

function WidgetSummaryCard({ widget }: { widget: AdminWidget }) {
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack gap="300" align="space-between" blockAlign="start">
          <BlockStack gap="100">
            <Text as="h3" variant="headingMd">
              {widget.title}
            </Text>
            <Text as="p" tone="subdued">
              {widget.videos.length} attached videos · Updated {formatWidgetDate(widget.updatedAt)}
            </Text>
          </BlockStack>
          <Badge tone={toWidgetStatusTone(widget.status)}>{widget.status}</Badge>
        </InlineStack>
        <InlineStack gap="200">
          <Button url={`/widgets/${widget.id}`}>View details</Button>
          {widget.status !== "PUBLISHED" ? (
            <Button url={`/widgets/${widget.id}`}>Publish</Button>
          ) : null}
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

function AttachedVideoRow({
  video,
  isDetaching,
  onDetach,
}: {
  video: VideoLibraryItem;
  isDetaching: boolean;
  onDetach: () => void;
}) {
  return (
    <InlineStack gap="300" align="space-between" blockAlign="center">
      <VideoSummary video={video} />
      <Button tone="critical" onClick={onDetach} loading={isDetaching}>
        Detach
      </Button>
    </InlineStack>
  );
}

function ReadyVideoCard({
  video,
  isAttached,
  isAttaching,
  onAttach,
}: {
  video: VideoLibraryItem;
  isAttached: boolean;
  isAttaching: boolean;
  onAttach: () => void;
}) {
  return (
    <Card>
      <BlockStack gap="300">
        <VideoSummary video={video} />
        <Button onClick={onAttach} loading={isAttaching} disabled={isAttached}>
          {isAttached ? "Attached" : "Attach video"}
        </Button>
      </BlockStack>
    </Card>
  );
}

function UnavailableVideoRow({ video }: { video: VideoLibraryItem }) {
  return (
    <InlineStack gap="300" align="space-between" blockAlign="center">
      <VideoSummary video={video} />
      <Text as="span" tone="subdued">
        {toUnavailableVideoMessage(video.status)}
      </Text>
    </InlineStack>
  );
}

function VideoSummary({ video }: { video: VideoLibraryItem }) {
  return (
    <BlockStack gap="050">
      <Text as="p" fontWeight="medium">
        {video.originalFilename}
      </Text>
      <Text as="p" tone="subdued">
        {video.status} · {video.contentType} · {formatVideoFileSize(video.sizeBytes)} ·{" "}
        {formatVideoDuration(video.durationMs)}
      </Text>
    </BlockStack>
  );
}

function toWidgetStatusTone(status: AdminWidgetStatus): "success" | "info" | "critical" {
  if (status === "PUBLISHED") {
    return "success";
  }

  if (status === "ARCHIVED") {
    return "critical";
  }

  return "info";
}

function toUnavailableVideoMessage(status: VideoLibraryStatus): string {
  if (status === "FAILED") {
    return "Retry processing from Videos before attaching.";
  }

  if (status === "PROCESSING") {
    return "Processing must finish before attaching.";
  }

  return "Video must be ready before attaching.";
}

function formatWidgetDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
