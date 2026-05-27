import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Modal,
  Page,
  Spinner,
  Text,
} from "@shopify/polaris";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router";

import {
  fetchAdminProductSearch,
  type ProductSearchClient,
} from "../services/product-search";
import {
  archiveAdminVideo,
  fetchAdminVideoDetail,
  formatVideoDuration,
  retryAdminVideoProcessing,
  VIDEO_LIBRARY_SAFE_ERROR_MESSAGE,
  type VideoArchiveClient,
  type VideoDetailClient,
  type VideoLibraryItem,
  type VideoRetryProcessingClient,
} from "../services/video-library";
import {
  createVideoProductTag as createAdminVideoProductTag,
  deleteVideoProductTag as deleteAdminVideoProductTag,
  fetchVideoProductTags,
  type CreateVideoProductTagClient,
  type DeleteVideoProductTagClient,
  type VideoProductTagsClient,
} from "../services/video-product-tags";
import { formatVideoFileSize } from "../services/video-upload";
import {
  canShowProductTagging,
  formatVideoDate,
  formatVideoDimensions,
  toVideoReadinessMessage,
  toVideoStatusTone,
  VideoProductTaggingPanel,
} from "./VideosPage";

type VideoDetailPageProps = {
  loadVideoDetail?: VideoDetailClient;
  archiveVideo?: VideoArchiveClient;
  retryVideoProcessing?: VideoRetryProcessingClient;
  searchProducts?: ProductSearchClient;
  loadVideoProductTags?: VideoProductTagsClient;
  createVideoProductTag?: CreateVideoProductTagClient;
  deleteVideoProductTag?: DeleteVideoProductTagClient;
};

type VideoDetailState =
  | { status: "loading"; video: VideoLibraryItem | null; message?: undefined }
  | { status: "ready"; video: VideoLibraryItem; message?: undefined }
  | { status: "error"; video: VideoLibraryItem | null; message: string };

export function VideoDetailPage({
  loadVideoDetail = fetchAdminVideoDetail,
  archiveVideo = archiveAdminVideo,
  retryVideoProcessing = retryAdminVideoProcessing,
  searchProducts = fetchAdminProductSearch,
  loadVideoProductTags = fetchVideoProductTags,
  createVideoProductTag = createAdminVideoProductTag,
  deleteVideoProductTag = deleteAdminVideoProductTag,
}: VideoDetailPageProps) {
  const { videoId } = useParams<{ videoId: string }>();
  const [detailState, setDetailState] = useState<VideoDetailState>({
    status: "loading",
    video: null,
  });
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const latestRequestIdRef = useRef(0);
  const video = detailState.video;
  const canRetryProcessing =
    video?.source === "MANUAL_UPLOAD" && (video.status === "UPLOADED" || video.status === "FAILED");

  const loadDetail = useCallback(async () => {
    await Promise.resolve();

    if (!videoId) {
      setDetailState({
        status: "error",
        video: null,
        message: VIDEO_LIBRARY_SAFE_ERROR_MESSAGE,
      });
      return;
    }

    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;

    setDetailState((currentState) => ({
      status: "loading",
      video: currentState.video,
    }));

    try {
      const loadedVideo = await loadVideoDetail(videoId);

      if (latestRequestIdRef.current !== requestId) {
        return;
      }

      setDetailState({ status: "ready", video: loadedVideo });
    } catch {
      if (latestRequestIdRef.current !== requestId) {
        return;
      }

      setDetailState((currentState) => ({
        status: "error",
        video: currentState.video,
        message: VIDEO_LIBRARY_SAFE_ERROR_MESSAGE,
      }));
    }
  }, [loadVideoDetail, videoId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDetail();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadDetail]);

  async function handleArchiveVideo() {
    if (!video) {
      return;
    }

    try {
      setIsArchiving(true);
      const archivedVideo = await archiveVideo(video.id);
      setDetailState({ status: "ready", video: archivedVideo });
      setArchiveModalOpen(false);
    } catch {
      setDetailState((currentState) => ({
        status: "error",
        video: currentState.video,
        message: VIDEO_LIBRARY_SAFE_ERROR_MESSAGE,
      }));
    } finally {
      setIsArchiving(false);
    }
  }

  async function handleRetryProcessing() {
    if (!video) {
      return;
    }

    try {
      setIsRetrying(true);
      const retriedVideo = await retryVideoProcessing(video.id);
      setDetailState({ status: "ready", video: retriedVideo });
    } catch {
      setDetailState((currentState) => ({
        status: "error",
        video: currentState.video,
        message: VIDEO_LIBRARY_SAFE_ERROR_MESSAGE,
      }));
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <Page
      title="Video details"
      subtitle="Tag products before attaching a ready video to widgets"
      backAction={{ content: "Videos", url: "/videos" }}
    >
      <BlockStack gap="400">
        {detailState.status === "error" ? (
          <Banner tone="critical" title="Video details unavailable">
            {detailState.message}
          </Banner>
        ) : null}

        {detailState.status === "loading" ? (
          <Card>
            <InlineStack gap="300" blockAlign="center">
              <Spinner accessibilityLabel="Loading video details" size="small" />
              <Text as="p" tone="subdued">
                Loading video details
              </Text>
            </InlineStack>
          </Card>
        ) : null}

        {video ? (
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="300" align="space-between" blockAlign="start">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingLg">
                    {video.originalFilename}
                  </Text>
                  <Text as="p" tone="subdued">
                    {video.contentType} · {formatVideoFileSize(video.sizeBytes)}
                  </Text>
                </BlockStack>
                <InlineStack gap="200">
                  <Badge tone={toVideoStatusTone(video.status)}>{video.status}</Badge>
                  <Badge tone="info">{video.source}</Badge>
                </InlineStack>
              </InlineStack>

              <InlineStack gap="500">
                <Text as="p">Duration: {formatVideoDuration(video.durationMs)}</Text>
                <Text as="p">Dimensions: {formatVideoDimensions(video)}</Text>
              </InlineStack>

              <Text as="p" tone={video.status === "READY" ? "success" : "subdued"}>
                {toVideoReadinessMessage(video.status)}
              </Text>

              <BlockStack gap="050">
                <Text as="p" tone="subdued">
                  ID: {video.id}
                </Text>
                <Text as="p" tone="subdued">
                  Created: {formatVideoDate(video.createdAt)}
                </Text>
                <Text as="p" tone="subdued">
                  Updated: {formatVideoDate(video.updatedAt)}
                </Text>
              </BlockStack>

              <InlineStack gap="300">
                <Button onClick={() => void loadDetail()} loading={detailState.status === "loading"}>
                  Refresh details
                </Button>
                {canRetryProcessing ? (
                  <Button onClick={() => void handleRetryProcessing()} loading={isRetrying}>
                    Retry processing
                  </Button>
                ) : null}
                <Button
                  tone="critical"
                  onClick={() => setArchiveModalOpen(true)}
                  disabled={video.status === "ARCHIVED"}
                >
                  Archive
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        ) : null}

        {video && canShowProductTagging(video.status) ? (
          <Card>
            <VideoProductTaggingPanel
              key={video.id}
              video={video}
              searchProducts={searchProducts}
              loadVideoProductTags={loadVideoProductTags}
              createVideoProductTag={createVideoProductTag}
              deleteVideoProductTag={deleteVideoProductTag}
            />
          </Card>
        ) : null}

        {video && !canShowProductTagging(video.status) ? (
          <Banner tone="info" title="Product tagging is available when the video is ready">
            {toVideoReadinessMessage(video.status)}
          </Banner>
        ) : null}
      </BlockStack>

      <Modal
        open={archiveModalOpen}
        onClose={() => {
          if (!isArchiving) {
            setArchiveModalOpen(false);
          }
        }}
        title="Archive video?"
        primaryAction={{
          content: "Archive",
          destructive: true,
          loading: isArchiving,
          onAction: () => void handleArchiveVideo(),
        }}
        secondaryActions={[
          {
            content: "Cancel",
            disabled: isArchiving,
            onAction: () => setArchiveModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Archive {video?.originalFilename ?? "this video"}? Archived videos are removed from
            active widget setup and cannot be attached to storefront widgets.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
