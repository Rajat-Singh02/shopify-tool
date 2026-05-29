import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  EmptyState,
  InlineStack,
  Modal,
  Page,
  Spinner,
  Text,
  TextField,
} from "@shopify/polaris";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import {
  PRODUCT_SEARCH_SAFE_ERROR_MESSAGE,
  type ProductSearchClient,
  type ProductSearchProduct,
  type ProductSearchResult,
  type ProductSearchVariant,
} from "../services/product-search";
import {
  archiveAdminVideo,
  fetchAdminVideoLibrary,
  formatVideoDuration,
  retryAdminVideoProcessing,
  VIDEO_LIBRARY_SAFE_ERROR_MESSAGE,
  type VideoArchiveClient,
  type VideoLibraryClient,
  type VideoLibraryItem,
  type VideoLibraryResult,
  type VideoLibrarySource,
  type VideoLibraryStatus,
  type VideoRetryProcessingClient,
} from "../services/video-library";
import {
  VIDEO_PRODUCT_TAGS_SAFE_ERROR_MESSAGE,
  type CreateVideoProductTagClient,
  type DeleteVideoProductTagClient,
  type VideoProductTag,
  type VideoProductTagsClient,
  type VideoProductTagsResult,
} from "../services/video-product-tags";
import {
  ALLOWED_VIDEO_MIME_TYPES,
  formatVideoFileSize,
  uploadManualVideo,
  validateVideoFile,
  VIDEO_UPLOAD_SAFE_ERROR_MESSAGE,
  type UploadedVideo,
  type VideoUploadClient,
} from "../services/video-upload";

type VideosPageProps = {
  uploadVideo?: VideoUploadClient;
  loadVideoLibrary?: VideoLibraryClient;
  archiveVideo?: VideoArchiveClient;
  retryVideoProcessing?: VideoRetryProcessingClient;
};

type UploadState =
  | { status: "idle"; error?: string; video?: undefined }
  | { status: "creating-intent"; error?: undefined; video?: undefined }
  | { status: "uploading"; error?: undefined; video?: undefined }
  | { status: "completing"; error?: undefined; video?: undefined }
  | { status: "success"; error?: undefined; video: UploadedVideo }
  | { status: "error"; error: string; video?: undefined };

type VideoLibraryState =
  | { status: "loading"; result: VideoLibraryResult | null; message?: undefined }
  | { status: "loading-more"; result: VideoLibraryResult; message?: undefined }
  | { status: "ready"; result: VideoLibraryResult; message?: undefined }
  | { status: "error"; result: VideoLibraryResult | null; message: string };

const EMPTY_VIDEO_LIBRARY_RESULT: VideoLibraryResult = {
  videos: [],
  pageInfo: {
    hasNextPage: false,
    endCursor: null,
  },
};

export function VideosPage({
  uploadVideo = uploadManualVideo,
  loadVideoLibrary = fetchAdminVideoLibrary,
  archiveVideo = archiveAdminVideo,
  retryVideoProcessing = retryAdminVideoProcessing,
}: VideosPageProps) {
  const fileInputId = useId();
  const statusFilterId = useId();
  const sourceFilterId = useId();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | undefined>();
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<VideoLibraryStatus | "">("");
  const [sourceFilter, setSourceFilter] = useState<VideoLibrarySource | "">("");
  const [libraryState, setLibraryState] = useState<VideoLibraryState>({
    status: "loading",
    result: null,
  });
  const [archiveLoadingId, setArchiveLoadingId] = useState<string | null>(null);
  const [retryLoadingId, setRetryLoadingId] = useState<string | null>(null);
  const [videoPendingArchive, setVideoPendingArchive] = useState<VideoLibraryItem | null>(null);
  const latestLibraryRequestIdRef = useRef(0);
  const isUploading =
    uploadState.status === "creating-intent" ||
    uploadState.status === "uploading" ||
    uploadState.status === "completing";
  const isInitialLibraryLoading = libraryState.status === "loading";
  const isLoadingMoreVideos = libraryState.status === "loading-more";
  const libraryResult = libraryState.result;
  const selectedFileError = selectedFile
    ? (validationMessage ?? validateVideoFile(selectedFile))
    : validationMessage;

  const loadVideos = useCallback(
    async ({ after, append }: { after?: string | null; append?: boolean } = {}) => {
      const previousResult = libraryState.result;
      const requestId = latestLibraryRequestIdRef.current + 1;

      latestLibraryRequestIdRef.current = requestId;

      setLibraryState(
        append && previousResult
          ? { status: "loading-more", result: previousResult }
          : { status: "loading", result: append ? previousResult : null },
      );

      try {
        const nextResult = await loadVideoLibrary({
          q: query,
          status: statusFilter,
          source: sourceFilter,
          first: 20,
          after,
        });

        if (latestLibraryRequestIdRef.current !== requestId) {
          return;
        }

        setLibraryState({
          status: "ready",
          result:
            append && previousResult
              ? {
                  videos: [...previousResult.videos, ...nextResult.videos],
                  pageInfo: nextResult.pageInfo,
                }
              : nextResult,
        });
      } catch {
        if (latestLibraryRequestIdRef.current !== requestId) {
          return;
        }

        setLibraryState((currentState) => ({
          status: "error",
          result: currentState.result ?? previousResult,
          message: VIDEO_LIBRARY_SAFE_ERROR_MESSAGE,
        }));
      }
    },
    [libraryState.result, loadVideoLibrary, query, sourceFilter, statusFilter],
  );

  useEffect(() => {
    let isMounted = true;

    loadVideoLibrary({
      first: 20,
      q: "",
      status: "",
      source: "",
      after: undefined,
    })
      .then((result) => {
        if (isMounted) {
          setLibraryState({ status: "ready", result });
        }
      })
      .catch(() => {
        if (isMounted) {
          setLibraryState({
            status: "error",
            result: null,
            message: VIDEO_LIBRARY_SAFE_ERROR_MESSAGE,
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [loadVideoLibrary]);

  async function handleUpload() {
    const error = validateVideoFile(selectedFile);

    if (error || !selectedFile) {
      setValidationMessage(error);
      setUploadState({ status: "idle" });
      return;
    }

    try {
      setUploadState({ status: "creating-intent" });
      await Promise.resolve();
      setUploadState({ status: "uploading" });
      const result = await uploadVideo(selectedFile);
      setUploadState({ status: "completing" });
      await Promise.resolve();
      setUploadState({ status: "success", video: result.video });
      await loadVideos();
    } catch {
      setUploadState({
        status: "error",
        error: VIDEO_UPLOAD_SAFE_ERROR_MESSAGE,
      });
    }
  }

  function handleFileChange(fileList: FileList | null) {
    const file = fileList?.[0] ?? null;

    setSelectedFile(file);
    setValidationMessage(validateVideoFile(file));
    setUploadState({ status: "idle" });
  }

  function resetUpload() {
    setSelectedFile(null);
    setValidationMessage(undefined);
    setUploadState({ status: "idle" });
  }

  async function handleArchiveVideo(video: VideoLibraryItem) {
    try {
      setArchiveLoadingId(video.id);
      const archivedVideo = await archiveVideo(video.id);
      setLibraryState((currentState) => {
        const currentResult = currentState.result ?? EMPTY_VIDEO_LIBRARY_RESULT;

        return {
          status: "ready",
          result: {
            ...currentResult,
            videos: currentResult.videos.map((currentVideo) =>
              currentVideo.id === archivedVideo.id ? archivedVideo : currentVideo,
            ),
          },
        };
      });
      setVideoPendingArchive(null);
    } catch {
      setLibraryState((currentState) => ({
        status: "error",
        result: currentState.result,
        message: VIDEO_LIBRARY_SAFE_ERROR_MESSAGE,
      }));
    } finally {
      setArchiveLoadingId(null);
    }
  }

  async function handleRetryVideoProcessing(video: VideoLibraryItem) {
    try {
      setRetryLoadingId(video.id);
      const retriedVideo = await retryVideoProcessing(video.id);

      replaceLibraryVideo(retriedVideo);
    } catch {
      setLibraryState((currentState) => ({
        status: "error",
        result: currentState.result,
        message: VIDEO_LIBRARY_SAFE_ERROR_MESSAGE,
      }));
    } finally {
      setRetryLoadingId(null);
    }
  }

  function replaceLibraryVideo(video: VideoLibraryItem) {
    setLibraryState((currentState) => {
      const currentResult = currentState.result ?? EMPTY_VIDEO_LIBRARY_RESULT;

      return {
        status: "ready",
        result: {
          ...currentResult,
          videos: currentResult.videos.map((currentVideo) =>
            currentVideo.id === video.id ? video : currentVideo,
          ),
        },
      };
    });
  }

  return (
    <Page title="Videos" subtitle="Upload manual videos for future shoppable placements">
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                Manual upload
              </Text>
              <Text as="p" tone="subdued">
                Add one MP4, MOV, or WebM file. Ready videos can be tagged and attached to widgets.
              </Text>
            </BlockStack>

            <BlockStack gap="200">
              <label htmlFor={fileInputId}>
                <Text as="span" fontWeight="medium">
                  Video file
                </Text>
              </label>
              <input
                id={fileInputId}
                aria-label="Video file"
                type="file"
                accept={ALLOWED_VIDEO_MIME_TYPES.join(",")}
                disabled={isUploading}
                onChange={(event) => handleFileChange(event.currentTarget.files)}
              />
              <Text as="p" tone="subdued">
                Maximum file size: 500 MB.
              </Text>
            </BlockStack>

            {selectedFile ? (
              <Card>
                <BlockStack gap="100">
                  <Text as="h3" variant="headingSm">
                    Selected file
                  </Text>
                  <Text as="p">{selectedFile.name}</Text>
                  <Text as="p" tone="subdued">
                    {selectedFile.type || "Unknown MIME type"} ·{" "}
                    {formatVideoFileSize(selectedFile.size)}
                  </Text>
                </BlockStack>
              </Card>
            ) : null}

            {selectedFileError ? (
              <Banner tone="critical" title="Video file unavailable">
                {selectedFileError}
              </Banner>
            ) : null}

            {uploadState.status === "error" ? (
              <Banner tone="critical" title="Video upload failed">
                {uploadState.error}
              </Banner>
            ) : null}

            {isUploading ? (
              <Banner tone="info" title={toUploadProgressTitle(uploadState.status)}>
                Keep this page open while the video upload request finishes.
              </Banner>
            ) : null}

            {uploadState.status === "success" ? (
              <Banner tone="success" title="Video uploaded">
                {toUploadSuccessMessage(uploadState.video)}
              </Banner>
            ) : null}

            <InlineStack gap="300">
              <Button
                variant="primary"
                onClick={() => void handleUpload()}
                loading={isUploading}
                disabled={!selectedFile || Boolean(selectedFileError) || isUploading}
              >
                Upload video
              </Button>
              <Button onClick={resetUpload} disabled={isUploading}>
                Choose another file
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                Video library
              </Text>
              <Text as="p" tone="subdued">
                Review uploaded videos and archive items that should no longer appear in the active
                library.
              </Text>
            </BlockStack>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void loadVideos();
              }}
            >
              <BlockStack gap="300">
                <TextField
                  label="Search videos"
                  value={query}
                  onChange={setQuery}
                  autoComplete="off"
                  placeholder="Search by original filename"
                />
                <InlineStack gap="300" blockAlign="end">
                  <BlockStack gap="100">
                    <label htmlFor={statusFilterId}>
                      <Text as="span" fontWeight="medium">
                        Status
                      </Text>
                    </label>
                    <select
                      id={statusFilterId}
                      aria-label="Status"
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(event.currentTarget.value as VideoLibraryStatus | "")
                      }
                    >
                      <option value="">Any status</option>
                      <option value="UPLOADED">Uploaded</option>
                      <option value="PROCESSING">Processing</option>
                      <option value="READY">Ready</option>
                      <option value="FAILED">Failed</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </BlockStack>
                  <BlockStack gap="100">
                    <label htmlFor={sourceFilterId}>
                      <Text as="span" fontWeight="medium">
                        Source
                      </Text>
                    </label>
                    <select
                      id={sourceFilterId}
                      aria-label="Source"
                      value={sourceFilter}
                      onChange={(event) =>
                        setSourceFilter(event.currentTarget.value as VideoLibrarySource | "")
                      }
                    >
                      <option value="">Any source</option>
                      <option value="MANUAL_UPLOAD">Manual upload</option>
                    </select>
                  </BlockStack>
                  <Button
                    variant="primary"
                    submit
                    loading={isInitialLibraryLoading}
                    disabled={isLoadingMoreVideos}
                  >
                    Apply filters
                  </Button>
                </InlineStack>
              </BlockStack>
            </form>
          </BlockStack>
        </Card>

        {libraryState.status === "error" ? (
          <Banner tone="critical" title="Video library unavailable">
            {libraryState.message}
          </Banner>
        ) : null}

        {isInitialLibraryLoading ? (
          <Card>
            <InlineStack gap="300" blockAlign="center">
              <Spinner accessibilityLabel="Loading video library" size="small" />
              <Text as="p" tone="subdued">
                Loading video library
              </Text>
            </InlineStack>
          </Card>
        ) : null}

        {libraryResult && libraryResult.videos.length === 0 && !isInitialLibraryLoading ? (
          <Card>
            <EmptyState
              heading="No videos found"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Upload a video or adjust the library filters.</p>
            </EmptyState>
          </Card>
        ) : null}

        {libraryResult && libraryResult.videos.length > 0 ? (
          <BlockStack gap="300">
            {libraryResult.videos.map((video) => (
              <VideoLibraryCard
                key={video.id}
                video={video}
                isArchiving={archiveLoadingId === video.id}
                isRetrying={retryLoadingId === video.id}
                onArchive={() => setVideoPendingArchive(video)}
                onRetryProcessing={() => void handleRetryVideoProcessing(video)}
              />
            ))}
            <InlineStack align="center">
              <Button
                onClick={() =>
                  void loadVideos({
                    after: libraryResult.pageInfo.endCursor,
                    append: true,
                  })
                }
                loading={isLoadingMoreVideos}
                disabled={!libraryResult.pageInfo.hasNextPage || isInitialLibraryLoading}
              >
                Load more videos
              </Button>
            </InlineStack>
          </BlockStack>
        ) : null}
        <Modal
          open={videoPendingArchive !== null}
          onClose={() => {
            if (archiveLoadingId === null) {
              setVideoPendingArchive(null);
            }
          }}
          title="Archive video?"
          primaryAction={{
            content: "Archive",
            destructive: true,
            loading: videoPendingArchive !== null && archiveLoadingId === videoPendingArchive.id,
            onAction: () => {
              if (videoPendingArchive) {
                void handleArchiveVideo(videoPendingArchive);
              }
            },
          }}
          secondaryActions={[
            {
              content: "Cancel",
              disabled: archiveLoadingId !== null,
              onAction: () => setVideoPendingArchive(null),
            },
          ]}
        >
          <Modal.Section>
            <Text as="p">
              Archive {videoPendingArchive?.originalFilename ?? "this video"}? Archived videos are
              removed from active widget setup and cannot be attached to storefront widgets.
            </Text>
          </Modal.Section>
        </Modal>
      </BlockStack>
    </Page>
  );
}

function toUploadProgressTitle(status: UploadState["status"]): string {
  if (status === "creating-intent") {
    return "Preparing upload";
  }

  if (status === "uploading") {
    return "Uploading video";
  }

  if (status === "completing") {
    return "Completing upload";
  }

  return "Uploading video";
}

function toUploadSuccessMessage(video: UploadedVideo): string {
  if (video.status === "READY") {
    return `Video ${video.id} is ready. Tag products, then attach it from Widgets.`;
  }

  if (video.status === "FAILED") {
    return `Video ${video.id} uploaded, but processing failed. Use Retry processing in the library below.`;
  }

  if (video.status === "PROCESSING") {
    return `Video ${video.id} uploaded and is processing. It can be attached to widgets after it is ready.`;
  }

  return `Video ${video.id} uploaded and is waiting for processing. It can be attached to widgets after it is ready.`;
}

function VideoLibraryCard({
  video,
  isArchiving,
  isRetrying,
  onArchive,
  onRetryProcessing,
}: {
  video: VideoLibraryItem;
  isArchiving: boolean;
  isRetrying: boolean;
  onArchive: () => void;
  onRetryProcessing: () => void;
}) {
  const canRetryProcessing =
    video.source === "MANUAL_UPLOAD" && (video.status === "UPLOADED" || video.status === "FAILED");

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack gap="300" align="space-between" blockAlign="start">
          <BlockStack gap="100">
            <Text as="h3" variant="headingMd">
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

        <InlineStack gap="400">
          <Text as="p">Duration: {formatVideoDuration(video.durationMs)}</Text>
          <Text as="p">Dimensions: {formatVideoDimensions(video)}</Text>
        </InlineStack>

        <Text as="p" tone={video.status === "READY" ? "success" : "subdued"}>
          {toVideoReadinessMessage(video.status)}
        </Text>

        <BlockStack gap="050">
          <Text as="p" tone="subdued">
            Created: {formatVideoDate(video.createdAt)}
          </Text>
          <Text as="p" tone="subdued">
            Updated: {formatVideoDate(video.updatedAt)}
          </Text>
        </BlockStack>

        <InlineStack gap="300">
          <Button url={`/videos/${video.id}`}>
            View details
          </Button>
          <Button
            tone="critical"
            onClick={onArchive}
            loading={isArchiving}
            disabled={video.status === "ARCHIVED"}
          >
            Archive
          </Button>
          {canRetryProcessing ? (
            <Button onClick={onRetryProcessing} loading={isRetrying}>
              Retry processing
            </Button>
          ) : null}
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

export function canShowProductTagging(status: VideoLibraryStatus): boolean {
  return status === "READY" || status === "ARCHIVED";
}

export function toVideoReadinessMessage(status: VideoLibraryStatus): string {
  if (status === "READY") {
    return "Ready videos can be tagged and attached to widgets.";
  }

  if (status === "FAILED") {
    return "Processing failed. Retry processing before attaching this video to a widget.";
  }

  if (status === "PROCESSING") {
    return "Processing is in progress. This video can be attached after it is ready.";
  }

  if (status === "ARCHIVED") {
    return "Archived videos cannot be attached to widgets.";
  }

  return "This video is uploaded but not ready yet. Retry processing if it stays here.";
}

type TagState =
  | { status: "loading"; result: VideoProductTagsResult | null; message?: undefined }
  | { status: "ready"; result: VideoProductTagsResult; message?: undefined }
  | { status: "error"; result: VideoProductTagsResult | null; message: string };

type TagProductSearchState =
  | { status: "idle"; result: ProductSearchResult | null; message?: undefined }
  | { status: "loading"; result: ProductSearchResult | null; message?: undefined }
  | { status: "ready"; result: ProductSearchResult; message?: undefined }
  | { status: "error"; result: ProductSearchResult | null; message: string };

export function VideoProductTaggingPanel({
  video,
  searchProducts,
  loadVideoProductTags,
  createVideoProductTag,
  deleteVideoProductTag,
}: {
  video: VideoLibraryItem;
  searchProducts: ProductSearchClient;
  loadVideoProductTags: VideoProductTagsClient;
  createVideoProductTag: CreateVideoProductTagClient;
  deleteVideoProductTag: DeleteVideoProductTagClient;
}) {
  const [tagState, setTagState] = useState<TagState>({
    status: "loading",
    result: null,
  });
  const [productQuery, setProductQuery] = useState("");
  const [productSearchState, setProductSearchState] = useState<TagProductSearchState>({
    status: "idle",
    result: null,
  });
  const [taggingVariantId, setTaggingVariantId] = useState<string | null>(null);
  const [removingTagId, setRemovingTagId] = useState<string | null>(null);
  const [tagPendingRemoval, setTagPendingRemoval] = useState<VideoProductTag | null>(null);
  const latestTagRequestIdRef = useRef(0);
  const latestProductSearchRequestIdRef = useRef(0);
  const tags = tagState.result?.tags ?? [];
  const isArchived = video.status === "ARCHIVED";

  const loadTags = useCallback(async () => {
    const requestId = latestTagRequestIdRef.current + 1;

    latestTagRequestIdRef.current = requestId;

    setTagState((currentState) => ({
      status: "loading",
      result: currentState.result,
    }));

    try {
      const result = await loadVideoProductTags(video.id);

      if (latestTagRequestIdRef.current !== requestId) {
        return;
      }

      setTagState({
        status: "ready",
        result,
      });
    } catch {
      if (latestTagRequestIdRef.current !== requestId) {
        return;
      }

      setTagState((currentState) => ({
        status: "error",
        result: currentState.result,
        message: VIDEO_PRODUCT_TAGS_SAFE_ERROR_MESSAGE,
      }));
    }
  }, [loadVideoProductTags, video.id]);

  useEffect(() => {
    const requestId = latestTagRequestIdRef.current + 1;

    latestTagRequestIdRef.current = requestId;

    loadVideoProductTags(video.id)
      .then((result) => {
        if (latestTagRequestIdRef.current === requestId) {
          setTagState({
            status: "ready",
            result,
          });
        }
      })
      .catch(() => {
        if (latestTagRequestIdRef.current === requestId) {
          setTagState((currentState) => ({
            status: "error",
            result: currentState.result,
            message: VIDEO_PRODUCT_TAGS_SAFE_ERROR_MESSAGE,
          }));
        }
      });
  }, [loadVideoProductTags, video.id]);

  async function runProductSearch() {
    const requestId = latestProductSearchRequestIdRef.current + 1;

    latestProductSearchRequestIdRef.current = requestId;

    setProductSearchState((currentState) => ({
      status: "loading",
      result: currentState.result,
    }));

    try {
      const result = await searchProducts({
        q: productQuery,
        first: 20,
        after: undefined,
      });

      if (latestProductSearchRequestIdRef.current !== requestId) {
        return;
      }

      setProductSearchState({
        status: "ready",
        result,
      });
    } catch {
      if (latestProductSearchRequestIdRef.current !== requestId) {
        return;
      }

      setProductSearchState((currentState) => ({
        status: "error",
        result: currentState.result,
        message: PRODUCT_SEARCH_SAFE_ERROR_MESSAGE,
      }));
    }
  }

  async function addVariantTag(product: ProductSearchProduct, variant: ProductSearchVariant) {
    if (isArchived || isVariantAlreadyTagged(tags, variant.id)) {
      return;
    }

    try {
      setTaggingVariantId(variant.id);
      const tag = await createVideoProductTag(video.id, {
        productId: product.id,
        productTitle: product.title,
        productHandle: product.handle,
        variantId: variant.id,
        variantTitle: variant.title,
        sku: variant.sku,
      });

      setTagState((currentState) => {
        const currentTags = currentState.result?.tags ?? [];
        const existingTagIndex = currentTags.findIndex((currentTag) => currentTag.id === tag.id);
        const nextTags =
          existingTagIndex === -1
            ? [...currentTags, tag]
            : currentTags.map((currentTag) => (currentTag.id === tag.id ? tag : currentTag));

        return {
          status: "ready",
          result: {
            tags: nextTags,
          },
        };
      });
    } catch {
      setTagState((currentState) => ({
        status: "error",
        result: currentState.result,
        message: VIDEO_PRODUCT_TAGS_SAFE_ERROR_MESSAGE,
      }));
    } finally {
      setTaggingVariantId(null);
    }
  }

  async function removeTag(tag: VideoProductTag) {
    try {
      setRemovingTagId(tag.id);
      await deleteVideoProductTag(video.id, tag.id);
      setTagState((currentState) => ({
        status: "ready",
        result: {
          tags: (currentState.result?.tags ?? []).filter((currentTag) => currentTag.id !== tag.id),
        },
      }));
      setTagPendingRemoval(null);
    } catch {
      setTagState((currentState) => ({
        status: "error",
        result: currentState.result,
        message: VIDEO_PRODUCT_TAGS_SAFE_ERROR_MESSAGE,
      }));
      setTagPendingRemoval(null);
    } finally {
      setRemovingTagId(null);
    }
  }

  return (
    <BlockStack gap="300">
      <BlockStack gap="100">
        <Text as="h4" variant="headingSm">
          Product tags
        </Text>
        <Text as="p" tone="subdued">
          Tag this video with Shopify product variants. Product-only tags are not available yet.
        </Text>
      </BlockStack>

      {isArchived ? (
        <Banner tone="warning" title="Archived video">
          Archived videos cannot be tagged.
        </Banner>
      ) : null}

      {tagState.status === "loading" ? (
        <InlineStack gap="300" blockAlign="center">
          <Spinner accessibilityLabel="Loading video product tags" size="small" />
          <Text as="p" tone="subdued">
            Loading video product tags
          </Text>
        </InlineStack>
      ) : null}

      {tagState.status === "error" ? (
        <Banner tone="critical" title="Product tags unavailable">
          {tagState.message}
        </Banner>
      ) : null}

      {tagState.status === "ready" && tags.length === 0 ? (
        <Text as="p" tone="subdued">
          No product variants are tagged yet.
        </Text>
      ) : null}

      {tags.length > 0 ? (
        <BlockStack gap="200">
          {tags.map((tag) => (
            <InlineStack key={tag.id} gap="300" align="space-between" blockAlign="center">
              <BlockStack gap="050">
                <Text as="p" fontWeight="medium">
                  {tag.productTitle}
                </Text>
                <Text as="p" tone="subdued">
                  Variant: {tag.variantTitle ?? tag.variantId}
                </Text>
              </BlockStack>
              <Button
                onClick={() => setTagPendingRemoval(tag)}
                loading={removingTagId === tag.id}
                disabled={removingTagId !== null}
              >
                Remove tag
              </Button>
            </InlineStack>
          ))}
        </BlockStack>
      ) : null}

      <Modal
        open={tagPendingRemoval !== null}
        onClose={() => {
          if (removingTagId === null) {
            setTagPendingRemoval(null);
          }
        }}
        title="Remove product tag?"
        primaryAction={{
          content: "Remove tag",
          destructive: true,
          loading: tagPendingRemoval !== null && removingTagId === tagPendingRemoval.id,
          onAction: () => {
            if (tagPendingRemoval) {
              void removeTag(tagPendingRemoval);
            }
          },
        }}
        secondaryActions={[
          {
            content: "Cancel",
            disabled: removingTagId !== null,
            onAction: () => setTagPendingRemoval(null),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Remove {tagPendingRemoval?.productTitle ?? "this product"} from this video? The product
            will no longer appear in this video's shoppable tags.
          </Text>
        </Modal.Section>
      </Modal>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void runProductSearch();
        }}
      >
        <InlineStack gap="300" blockAlign="end">
          <div style={{ flex: 1 }}>
            <TextField
              label="Search products to tag"
              value={productQuery}
              onChange={setProductQuery}
              autoComplete="off"
              placeholder="Search by product title, handle, or SKU"
              disabled={isArchived}
            />
          </div>
          <Button
            variant="primary"
            submit
            loading={productSearchState.status === "loading"}
            disabled={isArchived}
          >
            Search products
          </Button>
        </InlineStack>
      </form>

      {productSearchState.status === "error" ? (
        <Banner tone="critical" title="Product search unavailable">
          {productSearchState.message}
        </Banner>
      ) : null}

      {productSearchState.status === "loading" ? (
        <InlineStack gap="300" blockAlign="center">
          <Spinner accessibilityLabel="Searching products to tag" size="small" />
          <Text as="p" tone="subdued">
            Searching products to tag
          </Text>
        </InlineStack>
      ) : null}

      {productSearchState.status === "ready" && productSearchState.result.products.length === 0 ? (
        <Text as="p" tone="subdued">
          No products found for tagging.
        </Text>
      ) : null}

      {productSearchState.result && productSearchState.result.products.length > 0 ? (
        <BlockStack gap="300">
          {productSearchState.result.products.map((product) => (
            <ProductTagSearchResult
              key={product.id}
              product={product}
              tags={tags}
              isArchived={isArchived}
              taggingVariantId={taggingVariantId}
              onTagVariant={(variant) => void addVariantTag(product, variant)}
            />
          ))}
        </BlockStack>
      ) : null}

      <Button onClick={() => void loadTags()} disabled={tagState.status === "loading"}>
        Refresh tags
      </Button>
    </BlockStack>
  );
}

function ProductTagSearchResult({
  product,
  tags,
  isArchived,
  taggingVariantId,
  onTagVariant,
}: {
  product: ProductSearchProduct;
  tags: VideoProductTag[];
  isArchived: boolean;
  taggingVariantId: string | null;
  onTagVariant: (variant: ProductSearchVariant) => void;
}) {
  return (
    <BlockStack gap="200">
      <InlineStack gap="300" align="space-between" blockAlign="center">
        <BlockStack gap="050">
          <Text as="p" fontWeight="medium">
            {product.title}
          </Text>
          <Text as="p" tone="subdued">
            {product.handle} · {product.status}
          </Text>
        </BlockStack>
      </InlineStack>

      {product.variants.length === 0 ? (
        <Text as="p" tone="subdued">
          No variants to tag.
        </Text>
      ) : (
        <BlockStack gap="100">
          {product.variants.map((variant) => {
            const isAlreadyTagged = isVariantAlreadyTagged(tags, variant.id);

            return (
              <InlineStack key={variant.id} gap="300" align="space-between" blockAlign="center">
                <BlockStack gap="050">
                  <Text as="p">{variant.title}</Text>
                  <Text as="p" tone="subdued">
                    SKU: {variant.sku || "None"} · {variant.price} · Inventory:{" "}
                    {variant.inventoryQuantity ?? "Unknown"}
                  </Text>
                </BlockStack>
                <Button
                  onClick={() => onTagVariant(variant)}
                  loading={taggingVariantId === variant.id}
                  disabled={isArchived || isAlreadyTagged || taggingVariantId !== null}
                >
                  {isAlreadyTagged ? "Tagged" : "Tag variant"}
                </Button>
              </InlineStack>
            );
          })}
        </BlockStack>
      )}
    </BlockStack>
  );
}

function isVariantAlreadyTagged(tags: VideoProductTag[], variantId: string): boolean {
  return tags.some((tag) => tag.variantId === variantId);
}

export function toVideoStatusTone(
  status: VideoLibraryStatus,
): "success" | "info" | "warning" | "critical" {
  if (status === "READY") {
    return "success";
  }

  if (status === "FAILED" || status === "ARCHIVED") {
    return "critical";
  }

  if (status === "PROCESSING") {
    return "warning";
  }

  return "info";
}

export function formatVideoDimensions(video: Pick<VideoLibraryItem, "width" | "height">): string {
  if (video.width === null || video.height === null) {
    return "Unknown dimensions";
  }

  return `${video.width} x ${video.height}`;
}

export function formatVideoDate(value: string): string {
  return new Date(value).toLocaleString();
}
