import { expect, test } from "@playwright/test";

const dashboardResponse = {
  shop: {
    domain: "test-shop.myshopify.com",
    installedAt: "2026-05-22T00:00:00.000Z",
  },
  overview: {
    activeScopeLabel: "Manual upload only",
  },
};

const readyVideo = {
  id: "video_1",
  source: "MANUAL_UPLOAD",
  status: "READY",
  originalFilename: "demo.mp4",
  contentType: "video/mp4",
  sizeBytes: 4,
  durationMs: 1000,
  width: 640,
  height: 360,
  createdAt: "2026-05-23T00:00:00.000Z",
  updatedAt: "2026-05-23T00:01:00.000Z",
};

const failedVideo = {
  ...readyVideo,
  status: "FAILED",
  originalFilename: "failed.mp4",
};

const widget = {
  id: "widget_1",
  title: "Homepage videos",
  status: "DRAFT",
  layout: "INLINE_CAROUSEL",
  createdAt: "2026-05-23T00:00:00.000Z",
  updatedAt: "2026-05-23T00:10:00.000Z",
  videos: [],
};

test("upload success explains that ready videos can be attached to widgets", async ({ page }) => {
  let hasUploaded = false;

  await page.route("**/api/admin/dashboard", async (route) => {
    await route.fulfill({ json: dashboardResponse });
  });
  await page.route("**/api/admin/videos/upload-intent", async (route) => {
    await route.fulfill({
      status: 201,
      json: {
        video: {
          id: "video_1",
          status: "UPLOADED",
          source: "MANUAL_UPLOAD",
          originalFilename: "demo.mp4",
          contentType: "video/mp4",
          sizeBytes: 4,
        },
        upload: {
          method: "PUT",
          url: "/api/admin/videos/video_1/upload",
          headers: {
            "Content-Type": "video/mp4",
          },
          expiresAt: "2026-05-23T00:15:00.000Z",
        },
      },
    });
  });
  await page.route("**/api/admin/videos/video_1/upload", async (route) => {
    hasUploaded = true;
    await route.fulfill({ json: { video: readyVideo } });
  });
  await page.route("**/api/admin/videos/video_1/complete-upload", async (route) => {
    await route.fulfill({ json: { video: readyVideo } });
  });
  await page.route("**/api/admin/videos?*", async (route) => {
    await route.fulfill({
      json: {
        videos: hasUploaded ? [readyVideo] : [],
        pageInfo: {
          hasNextPage: false,
          endCursor: null,
        },
      },
    });
  });

  await page.goto("/videos");
  await page.getByLabel("Video file").setInputFiles({
    name: "demo.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from([1, 2, 3, 4]),
  });
  await page.getByRole("button", { name: "Upload video" }).click();

  await expect(
    page.getByText("Video video_1 is ready. Tag products, then attach it from Widgets."),
  ).toBeVisible();
  await expect(
    page.getByText("Ready videos can be tagged and attached to widgets.", { exact: true }),
  ).toBeVisible();
});

test("widgets show unavailable videos and attach ready candidates", async ({ page }) => {
  let attached = false;

  await page.route("**/api/admin/dashboard", async (route) => {
    await route.fulfill({ json: dashboardResponse });
  });
  await page.route("**/api/admin/widgets", async (route) => {
    await route.fulfill({
      json: {
        widgets: [{ ...widget, videos: attached ? [readyVideo] : [] }],
      },
    });
  });
  await page.route("**/api/admin/widgets/widget_1", async (route) => {
    await route.fulfill({
      json: {
        widget: { ...widget, videos: attached ? [readyVideo] : [] },
      },
    });
  });
  await page.route("**/api/admin/widgets/widget_1/videos", async (route) => {
    attached = true;
    await route.fulfill({
      json: {
        widget: { ...widget, videos: [readyVideo] },
      },
    });
  });
  await page.route("**/api/admin/videos?*", async (route) => {
    await route.fulfill({
      json: {
        videos: [failedVideo, readyVideo],
        pageInfo: {
          hasNextPage: false,
          endCursor: null,
        },
      },
    });
  });

  await page.goto("/widgets");
  await page.getByRole("link", { name: "View details" }).click();

  await expect(page.getByText("Uploaded videos not ready yet")).toBeVisible();
  await expect(page.getByText("failed.mp4")).toBeVisible();
  await expect(page.getByText("Retry processing from Videos before attaching.")).toBeVisible();

  await page.getByRole("button", { name: "Attach video" }).click();

  await expect(page.getByRole("button", { name: "Attached" })).toBeVisible();
});
