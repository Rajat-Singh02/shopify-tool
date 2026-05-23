import {
  Banner,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Page,
  Text,
} from "@shopify/polaris";
import { useId, useState } from "react";

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
};

type UploadState =
  | { status: "idle"; error?: string; video?: undefined }
  | { status: "creating-intent"; error?: undefined; video?: undefined }
  | { status: "uploading"; error?: undefined; video?: undefined }
  | { status: "completing"; error?: undefined; video?: undefined }
  | { status: "success"; error?: undefined; video: UploadedVideo }
  | { status: "error"; error: string; video?: undefined };

export function VideosPage({ uploadVideo = uploadManualVideo }: VideosPageProps) {
  const fileInputId = useId();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | undefined>();
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const isUploading =
    uploadState.status === "creating-intent" ||
    uploadState.status === "uploading" ||
    uploadState.status === "completing";
  const selectedFileError = selectedFile
    ? validationMessage ?? validateVideoFile(selectedFile)
    : validationMessage;

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
