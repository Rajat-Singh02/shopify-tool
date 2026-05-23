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
} from "@shopify/polaris";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  const [listState, setListState] = useState<WidgetListState>({
    status: "loading",
    widgets: [],
  });
  const [readyVideosState, setReadyVideosState] = useState<ReadyVideosState>({
    status: "idle",
    videos: [],
  });
  const [selectedWidget, setSelectedWidget] = useState<AdminWidget | null>(null);
  const [title, setTitle] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editStatus, setEditStatus] = useState<AdminWidgetStatus>("DRAFT");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [loadingWidgetId, setLoadingWidgetId] = useState<string | null>(null);
  const [attachingVideoId, setAttachingVideoId] = useState<string | null>(null);
  const [detachingVideoId, setDetachingVideoId] = useState<string | null>(null);
  const [snippetCopied, setSnippetCopied] = useState(false);
  const isLoading = listState.status === "loading";
  const selectedVideoIds = useMemo(
    () => new Set(selectedWidget?.videos.map((video) => video.id) ?? []),
    [selectedWidget],
  );
  const widgetScriptUrl = useMemo(() => getWidgetScriptUrl(), []);
  const embedSnippet = selectedWidget
    ? `<script src="${widgetScriptUrl}" data-shop="${
        shopDomain ?? "SHOP_DOMAIN"
      }" data-widget-id="${selectedWidget.id}"></script>`
    : "";

  const loadReadyVideos = useCallback(async () => {
    setReadyVideosState((currentState) => ({
      status: "loading",
      videos: currentState.videos,
    }));

    try {
      const result = await loadVideoLibrary({
        first: 50,
        status: "READY",
        source: "MANUAL_UPLOAD",
      });

      setReadyVideosState({ status: "ready", videos: result.videos });
    } catch {
      setReadyVideosState((currentState) => ({
        status: "error",
        videos: currentState.videos,
        message: "We could not load ready videos for this widget.",
      }));
    }
  }, [loadVideoLibrary]);

  useEffect(() => {
    let isMounted = true;

    loadWidgets()
      .then((result) => {
        if (isMounted) {
          setListState({ status: "ready", widgets: result.widgets });
        }
      })
      .catch(() => {
        if (isMounted) {
          setListState({
            status: "error",
            widgets: [],
            message: ADMIN_WIDGETS_SAFE_ERROR_MESSAGE,
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [loadWidgets]);

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
      setSelectedWidget(widget);
      setEditTitle(widget.title);
      setEditStatus(widget.status);
      setSnippetCopied(false);
      setListState((currentState) => ({
        status: "ready",
        widgets: [widget, ...currentState.widgets.filter((item) => item.id !== widget.id)],
      }));
      await loadReadyVideos();
    } catch {
      setActionMessage(ADMIN_WIDGETS_SAFE_ERROR_MESSAGE);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSelectWidget(widgetId: string) {
    try {
      setLoadingWidgetId(widgetId);
      setActionMessage(null);
      const widget = await loadWidgetDetail(widgetId);

      setSelectedWidget(widget);
      setEditTitle(widget.title);
      setEditStatus(widget.status);
      setSnippetCopied(false);
      await loadReadyVideos();
    } catch {
      setActionMessage(ADMIN_WIDGETS_SAFE_ERROR_MESSAGE);
    } finally {
      setLoadingWidgetId(null);
    }
  }

  async function handleUpdateWidget() {
    if (!selectedWidget) {
      return;
    }

    try {
      setIsUpdating(true);
      setActionMessage(null);
      const widget = await updateWidget(selectedWidget.id, {
        title: editTitle,
        status: editStatus,
      });

      replaceWidget(widget);
      setSelectedWidget(widget);
      setEditTitle(widget.title);
      setEditStatus(widget.status);
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
      setSelectedWidget(widget);
    } catch {
      setActionMessage(ADMIN_WIDGETS_SAFE_ERROR_MESSAGE);
    } finally {
      setAttachingVideoId(null);
    }
  }

  async function handleDetachVideo(videoId: string) {
    if (!selectedWidget) {
      return;
    }

    if (!window.confirm("Detach this video from the widget?")) {
      return;
    }

    try {
      setDetachingVideoId(videoId);
      setActionMessage(null);
      await detachVideo(selectedWidget.id, videoId);
      const widget = await loadWidgetDetail(selectedWidget.id);

      replaceWidget(widget);
      setSelectedWidget(widget);
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

  function replaceWidget(widget: AdminWidget) {
    setListState((currentState) => ({
      status: "ready",
      widgets: currentState.widgets.map((item) => (item.id === widget.id ? widget : item)),
    }));
  }

  return (
    <Page title="Widgets" subtitle="Create a storefront widget and attach ready videos">
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Create widget
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

        {listState.status === "error" ? (
          <Banner tone="critical" title="Widgets unavailable">
            {listState.message}
          </Banner>
        ) : null}

        {actionMessage ? (
          <Banner tone="critical" title="Widget action unavailable">
            {actionMessage}
          </Banner>
        ) : null}

        {isLoading ? (
          <Card>
            <InlineStack gap="300" blockAlign="center">
              <Spinner accessibilityLabel="Loading widgets" size="small" />
              <Text as="p" tone="subdued">
                Loading widgets
              </Text>
            </InlineStack>
          </Card>
        ) : null}

        {!isLoading && listState.widgets.length === 0 ? (
          <Card>
            <EmptyState
              heading="No widgets yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Create a widget to get an embed snippet for the storefront.</p>
            </EmptyState>
          </Card>
        ) : null}

        {listState.widgets.length > 0 ? (
          <BlockStack gap="300">
            {listState.widgets.map((widget) => (
              <WidgetSummaryCard
                key={widget.id}
                widget={widget}
                isSelected={selectedWidget?.id === widget.id}
                isLoading={loadingWidgetId === widget.id}
                onSelect={() => void handleSelectWidget(widget.id)}
              />
            ))}
          </BlockStack>
        ) : null}

        {selectedWidget ? (
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="start">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    Widget details
                  </Text>
                  <Text as="p" tone="subdued">
                    ID: {selectedWidget.id}
                  </Text>
                </BlockStack>
                <Badge tone={selectedWidget.status === "PUBLISHED" ? "success" : "info"}>
                  {selectedWidget.status}
                </Badge>
              </InlineStack>

              <BlockStack gap="300">
                <TextField
                  label="Widget title"
                  value={editTitle}
                  onChange={setEditTitle}
                  autoComplete="off"
                />
                <BlockStack gap="100">
                  <label htmlFor="widget-status">
                    <Text as="span" fontWeight="medium">
                      Widget status
                    </Text>
                  </label>
                  <select
                    id="widget-status"
                    aria-label="Widget status"
                    value={editStatus}
                    onChange={(event) =>
                      setEditStatus(event.currentTarget.value as AdminWidgetStatus)
                    }
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </BlockStack>
                <InlineStack>
                  <Button
                    variant="primary"
                    onClick={() => void handleUpdateWidget()}
                    loading={isUpdating}
                    disabled={!editTitle.trim() || isUpdating}
                  >
                    Save widget
                  </Button>
                </InlineStack>
              </BlockStack>

              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">
                  Embed snippet
                </Text>
                <pre aria-label="Widget embed snippet">{embedSnippet}</pre>
                <InlineStack gap="200" blockAlign="center">
                  <Button onClick={() => void handleCopySnippet()} disabled={!navigator.clipboard}>
                    Copy snippet
                  </Button>
                  {snippetCopied ? (
                    <Text as="span" tone="success">
                      Snippet copied
                    </Text>
                  ) : null}
                </InlineStack>
              </BlockStack>

              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">
                  Attached videos
                </Text>
                {selectedWidget.videos.length === 0 ? (
                  <Text as="p" tone="subdued">
                    No videos are attached to this widget yet.
                  </Text>
                ) : (
                  selectedWidget.videos.map((video) => (
                    <AttachedVideoRow
                      key={video.id}
                      video={video}
                      isDetaching={detachingVideoId === video.id}
                      onDetach={() => void handleDetachVideo(video.id)}
                    />
                  ))
                )}
              </BlockStack>

              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">
                  Attach ready videos
                </Text>
                {readyVideosState.status === "error" ? (
                  <Banner tone="critical" title="Ready videos unavailable">
                    {readyVideosState.message}
                  </Banner>
                ) : null}
                {readyVideosState.status === "loading" ? (
                  <InlineStack gap="300" blockAlign="center">
                    <Spinner accessibilityLabel="Loading ready videos" size="small" />
                    <Text as="p" tone="subdued">
                      Loading ready videos
                    </Text>
                  </InlineStack>
                ) : null}
                {readyVideosState.videos.length === 0 && readyVideosState.status !== "loading" ? (
                  <Text as="p" tone="subdued">
                    No ready manual upload videos are available to attach.
                  </Text>
                ) : null}
                {readyVideosState.videos.map((video) => (
                  <ReadyVideoRow
                    key={video.id}
                    video={video}
                    isAttached={selectedVideoIds.has(video.id)}
                    isAttaching={attachingVideoId === video.id}
                    onAttach={() => void handleAttachVideo(video.id)}
                  />
                ))}
              </BlockStack>
            </BlockStack>
          </Card>
        ) : null}
      </BlockStack>
    </Page>
  );
}

function getWidgetScriptUrl(): string {
  if (typeof window === "undefined") {
    return "/widget.js";
  }

  return `${window.location.origin}/widget.js`;
}

function WidgetSummaryCard({
  widget,
  isSelected,
  isLoading,
  onSelect,
}: {
  widget: AdminWidget;
  isSelected: boolean;
  isLoading: boolean;
  onSelect: () => void;
}) {
  return (
    <Card>
      <InlineStack gap="300" align="space-between" blockAlign="center">
        <BlockStack gap="100">
          <Text as="h3" variant="headingMd">
            {widget.title}
          </Text>
          <Text as="p" tone="subdued">
            {widget.videos.length} attached videos · Updated {formatWidgetDate(widget.updatedAt)}
          </Text>
        </BlockStack>
        <InlineStack gap="200" blockAlign="center">
          <Badge tone={widget.status === "PUBLISHED" ? "success" : "info"}>{widget.status}</Badge>
          <Button onClick={onSelect} loading={isLoading} disabled={isSelected && !isLoading}>
            {isSelected ? "Selected" : "View details"}
          </Button>
        </InlineStack>
      </InlineStack>
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

function ReadyVideoRow({
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
    <InlineStack gap="300" align="space-between" blockAlign="center">
      <VideoSummary video={video} />
      <Button onClick={onAttach} loading={isAttaching} disabled={isAttached}>
        {isAttached ? "Attached" : "Attach video"}
      </Button>
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

function formatWidgetDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
