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
import { useCallback, useEffect, useId, useState } from "react";

import {
  archiveAdminVideo,
  fetchAdminVideoDetail,
  fetchAdminVideoLibrary,
  formatVideoDuration,
  VIDEO_LIBRARY_SAFE_ERROR_MESSAGE,
  type VideoArchiveClient,
  type VideoDetailClient,
  type VideoLibraryClient,
  type VideoLibraryItem,
  type VideoLibraryResult,
  type VideoLibrarySource,
  type VideoLibraryStatus,
} from "../services/video-library";
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
  loadVideoDetail?: VideoDetailClient;
  archiveVideo?: VideoArchiveClient;
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
  loadVideoDetail = fetchAdminVideoDetail,
  archiveVideo = archiveAdminVideo,
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
  const [selectedVideo, setSelectedVideo] = useState<VideoLibraryItem | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [archiveLoadingId, setArchiveLoadingId] = useState<string | null>(null);
  const isUploading =
    uploadState.status === "creating-intent" ||
    uploadState.status === "uploading" ||
    uploadState.status === "completing";
  const isInitialLibraryLoading = libraryState.status === "loading";
  const isLoadingMoreVideos = libraryState.status === "loading-more";
  const libraryResult = libraryState.result;
  const selectedFileError = selectedFile
    ? validationMessage ?? validateVideoFile(selectedFile)
    : validationMessage;

  const loadVideos = useCallback(
    async ({ after, append }: { after?: string | null; append?: boolean } = {}) => {
      const previousResult = libraryState.result;

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
        setLibraryState({
          status: "error",
          result: previousResult,
          message: VIDEO_LIBRARY_SAFE_ERROR_MESSAGE,
        });
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

  async function handleLoadVideoDetail(videoId: string) {
    try {
      setDetailLoadingId(videoId);
      setSelectedVideo(await loadVideoDetail(videoId));
    } catch {
      setLibraryState({
        status: "error",
        result: libraryState.result,
        message: VIDEO_LIBRARY_SAFE_ERROR_MESSAGE,
      });
    } finally {
      setDetailLoadingId(null);
    }
  }

  async function handleArchiveVideo(video: VideoLibraryItem) {
    if (!window.confirm(`Archive ${video.originalFilename}?`)) {
      return;
    }

    try {
      setArchiveLoadingId(video.id);
      const archivedVideo = await archiveVideo(video.id);
      setSelectedVideo((currentVideo) =>
        currentVideo?.id === archivedVideo.id ? archivedVideo : currentVideo,
      );
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
    } catch {
      setLibraryState({
        status: "error",
        result: libraryState.result,
        message: VIDEO_LIBRARY_SAFE_ERROR_MESSAGE,
      });
    } finally {
      setArchiveLoadingId(null);
    }
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
                Add one MP4, MOV, or WebM file. Processing and tagging will be added in later
                features.
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
                Video {uploadState.video.id} is {uploadState.video.status}.
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
                Review uploaded videos and archive items that should no longer appear in the
                active library.
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
                isSelected={selectedVideo?.id === video.id}
                selectedVideo={selectedVideo?.id === video.id ? selectedVideo : null}
                isLoadingDetail={detailLoadingId === video.id}
                isArchiving={archiveLoadingId === video.id}
                onViewDetails={() => void handleLoadVideoDetail(video.id)}
                onArchive={() => void handleArchiveVideo(video)}
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

function VideoLibraryCard({
  video,
  isSelected,
  selectedVideo,
  isLoadingDetail,
  isArchiving,
  onViewDetails,
  onArchive,
}: {
  video: VideoLibraryItem;
  isSelected: boolean;
  selectedVideo: VideoLibraryItem | null;
  isLoadingDetail: boolean;
  isArchiving: boolean;
  onViewDetails: () => void;
  onArchive: () => void;
}) {
  const displayedVideo = selectedVideo ?? video;

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

        <BlockStack gap="050">
          <Text as="p" tone="subdued">
            Created: {formatVideoDate(video.createdAt)}
          </Text>
          <Text as="p" tone="subdued">
            Updated: {formatVideoDate(video.updatedAt)}
          </Text>
        </BlockStack>

        {isSelected ? (
          <BlockStack gap="100">
            <Text as="h4" variant="headingSm">
              Video details
            </Text>
            <Text as="p">ID: {displayedVideo.id}</Text>
            <Text as="p">Status: {displayedVideo.status}</Text>
            <Text as="p">Source: {displayedVideo.source}</Text>
            <Text as="p">Duration: {formatVideoDuration(displayedVideo.durationMs)}</Text>
            <Text as="p">Dimensions: {formatVideoDimensions(displayedVideo)}</Text>
          </BlockStack>
        ) : null}

        <InlineStack gap="300">
          <Button onClick={onViewDetails} loading={isLoadingDetail}>
            {isSelected ? "Refresh details" : "View details"}
          </Button>
          <Button
            tone="critical"
            onClick={onArchive}
            loading={isArchiving}
            disabled={video.status === "ARCHIVED"}
          >
            Archive
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

function toVideoStatusTone(status: VideoLibraryStatus): "success" | "info" | "warning" | "critical" {
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

function formatVideoDimensions(video: Pick<VideoLibraryItem, "width" | "height">): string {
  if (video.width === null || video.height === null) {
    return "Unknown dimensions";
  }

  return `${video.width} x ${video.height}`;
}

function formatVideoDate(value: string): string {
  return new Date(value).toLocaleString();
}
