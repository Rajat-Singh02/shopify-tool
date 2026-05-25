import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../app/App";
import { ADMIN_SHELL_SAFE_ERROR_MESSAGE } from "../services/admin-shell";
import type { AdminWidget } from "../services/admin-widgets";
import {
  PRODUCT_SEARCH_RECONNECT_MESSAGE,
  PRODUCT_SEARCH_SAFE_ERROR_MESSAGE,
} from "../services/product-search";
import {
  VIDEO_LIBRARY_SAFE_ERROR_MESSAGE,
  type VideoLibraryItem,
  type VideoLibraryResult,
} from "../services/video-library";
import {
  VIDEO_PRODUCT_TAGS_SAFE_ERROR_MESSAGE,
  type VideoProductTag,
  type VideoProductTagsResult,
} from "../services/video-product-tags";
import { VIDEO_UPLOAD_SAFE_ERROR_MESSAGE } from "../services/video-upload";

const readyDashboardState = {
  status: "ready" as const,
  data: {
    shop: {
      domain: "test-shop.myshopify.com",
      installedAt: "2026-05-22T00:00:00.000Z",
    },
    overview: {
      activeScopeLabel: "Manual upload only" as const,
    },
  },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const emptyVideoLibraryResult: VideoLibraryResult = {
  videos: [],
  pageInfo: {
    hasNextPage: false,
    endCursor: null,
  },
};

const readyVideo: VideoLibraryItem = {
  id: "video_1",
  source: "MANUAL_UPLOAD",
  status: "READY",
  originalFilename: "demo.mp4",
  contentType: "video/mp4",
  sizeBytes: 4 * 1024 * 1024,
  durationMs: 65000,
  width: 1920,
  height: 1080,
  createdAt: "2026-05-23T00:00:00.000Z",
  updatedAt: "2026-05-23T00:05:00.000Z",
};

const emptyVideoTagsResult: VideoProductTagsResult = {
  tags: [],
};

const readyVideoTag: VideoProductTag = {
  id: "tag_1",
  videoId: "video_1",
  productId: "gid://shopify/Product/1",
  productTitle: "Linen Shirt",
  variantId: "gid://shopify/ProductVariant/1",
  variantTitle: "Small",
  createdAt: "2026-05-23T00:06:00.000Z",
};

const readyWidget: AdminWidget = {
  id: "widget_1",
  title: "Homepage videos",
  status: "DRAFT",
  layout: "INLINE_CAROUSEL",
  createdAt: "2026-05-23T00:00:00.000Z",
  updatedAt: "2026-05-23T00:10:00.000Z",
  videos: [],
};

function renderApp(app: ReactElement, initialEntries = ["/"]) {
  return render(
    <AppProvider i18n={enTranslations}>
      <MemoryRouter initialEntries={initialEntries}>{app}</MemoryRouter>
    </AppProvider>,
  );
}

describe("admin app shell", () => {
  it("renders the connected shop domain", () => {
    renderApp(<App initialDashboardState={readyDashboardState} />);

    expect(screen.getByRole("heading", { name: "Shoppable Video" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Connected shop" })).toBeInTheDocument();
    expect(screen.getByText("test-shop.myshopify.com")).toBeInTheDocument();
    expect(screen.getByText("Manual upload only")).toBeInTheDocument();
  });

  it("renders a loading state while shop context loads", () => {
    renderApp(<App initialDashboardState={{ status: "loading" }} />);

    expect(screen.getAllByRole("heading", { name: "Loading shop context" }).length).toBeGreaterThan(
      0,
    );
  });

  it("renders a safe error state when shop context fails", () => {
    renderApp(
      <App
        initialDashboardState={{
          status: "error",
          message: ADMIN_SHELL_SAFE_ERROR_MESSAGE,
        }}
      />,
    );

    expect(screen.getByText("Shop context unavailable")).toBeInTheDocument();
    expect(screen.getByText(ADMIN_SHELL_SAFE_ERROR_MESSAGE)).toBeInTheDocument();
  });

  it("loads dashboard context through the shell service boundary", async () => {
    renderApp(<App loadDashboardContext={() => Promise.resolve(readyDashboardState.data)} />);

    expect(screen.getAllByRole("heading", { name: "Loading shop context" }).length).toBeGreaterThan(
      0,
    );

    await waitFor(() => {
      expect(screen.getByText("test-shop.myshopify.com")).toBeInTheDocument();
    });
  });

  it("renders the products page and searches products", async () => {
    const searchProducts = vi.fn().mockResolvedValue({
      products: [
        {
          id: "gid://shopify/Product/1",
          title: "Linen Shirt",
          handle: "linen-shirt",
          status: "ACTIVE",
          featuredImage: {
            url: "https://cdn.example.test/linen-shirt.jpg",
            altText: "Linen shirt",
          },
          variants: [
            {
              id: "gid://shopify/ProductVariant/1",
              title: "Small",
              sku: "LINEN-S",
              price: "24.00",
              inventoryQuantity: 7,
            },
          ],
        },
      ],
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
    });
    renderApp(<App initialDashboardState={readyDashboardState} searchProducts={searchProducts} />, [
      "/products",
    ]);

    expect(screen.getByRole("heading", { name: "Products" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search products"), {
      target: { value: "linen" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByText("Linen Shirt")).toBeInTheDocument();
    });

    expect(searchProducts).toHaveBeenCalledWith({
      q: "linen",
      first: 20,
      after: undefined,
    });
    expect(screen.getByText("linen-shirt")).toBeInTheDocument();
    expect(screen.getByText("Small")).toBeInTheDocument();
    expect(screen.getByText("SKU: LINEN-S")).toBeInTheDocument();
    expect(screen.getByText("24.00")).toBeInTheDocument();
    expect(screen.getByText("Inventory: 7")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("shopify-id-token");
    expect(document.body.textContent).not.toContain("SHOPIFY_API_SECRET");
  });

  it("renders product search loading and empty states", async () => {
    const searchProducts = vi.fn().mockResolvedValue({
      products: [],
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
    });
    renderApp(<App initialDashboardState={readyDashboardState} searchProducts={searchProducts} />, [
      "/products",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(screen.getAllByText("Searching products").length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getByText("No products found")).toBeInTheDocument();
    });
  });

  it("renders product search safe error state", async () => {
    renderApp(
      <App
        initialDashboardState={readyDashboardState}
        searchProducts={() => Promise.reject(new Error("raw backend failure"))}
      />,
      ["/products"],
    );

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByText("Product search unavailable")).toBeInTheDocument();
    });
    expect(screen.getByText(PRODUCT_SEARCH_SAFE_ERROR_MESSAGE)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("raw backend failure");
  });

  it("renders product search reconnect errors from the server", async () => {
    renderApp(
      <App
        initialDashboardState={readyDashboardState}
        searchProducts={() => Promise.reject(new Error(PRODUCT_SEARCH_RECONNECT_MESSAGE))}
      />,
      ["/products"],
    );

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByText("Product search unavailable")).toBeInTheDocument();
    });
    expect(screen.getByText(PRODUCT_SEARCH_RECONNECT_MESSAGE)).toBeInTheDocument();
  });

  it("loads more product search results with the returned cursor", async () => {
    const searchProducts = vi
      .fn()
      .mockResolvedValueOnce({
        products: [
          {
            id: "gid://shopify/Product/1",
            title: "First Product",
            handle: "first-product",
            status: "ACTIVE",
            featuredImage: null,
            variants: [],
          },
        ],
        pageInfo: {
          hasNextPage: true,
          endCursor: "cursor-1",
        },
      })
      .mockResolvedValueOnce({
        products: [
          {
            id: "gid://shopify/Product/2",
            title: "Second Product",
            handle: "second-product",
            status: "DRAFT",
            featuredImage: null,
            variants: [],
          },
        ],
        pageInfo: {
          hasNextPage: false,
          endCursor: "cursor-2",
        },
      });
    renderApp(<App initialDashboardState={readyDashboardState} searchProducts={searchProducts} />, [
      "/products",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => {
      expect(screen.getByText("First Product")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => {
      expect(screen.getByText("Second Product")).toBeInTheDocument();
    });

    expect(searchProducts).toHaveBeenLastCalledWith({
      q: "",
      first: 20,
      after: "cursor-1",
    });
  });

  it("uses the executed product query when loading more after the input changes", async () => {
    const searchProducts = vi
      .fn()
      .mockResolvedValueOnce({
        products: [
          {
            id: "gid://shopify/Product/1",
            title: "First Product",
            handle: "first-product",
            status: "ACTIVE",
            featuredImage: null,
            variants: [],
          },
        ],
        pageInfo: {
          hasNextPage: true,
          endCursor: "cursor-1",
        },
      })
      .mockResolvedValueOnce({
        products: [
          {
            id: "gid://shopify/Product/2",
            title: "Second Product",
            handle: "second-product",
            status: "ACTIVE",
            featuredImage: null,
            variants: [],
          },
        ],
        pageInfo: {
          hasNextPage: false,
          endCursor: "cursor-2",
        },
      });
    renderApp(<App initialDashboardState={readyDashboardState} searchProducts={searchProducts} />, [
      "/products",
    ]);

    fireEvent.change(screen.getByLabelText("Search products"), {
      target: { value: "linen" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => {
      expect(screen.getByText("First Product")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Search products"), {
      target: { value: "wool" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => {
      expect(screen.getByText("Second Product")).toBeInTheDocument();
    });

    expect(searchProducts).toHaveBeenLastCalledWith({
      q: "linen",
      first: 20,
      after: "cursor-1",
    });
  });

  it("ignores stale product search responses from older requests", async () => {
    let resolveFirstSearch: ((value: unknown) => void) | undefined;
    const searchProducts = vi
      .fn()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirstSearch = resolve;
        }),
      )
      .mockResolvedValueOnce({
        products: [
          {
            id: "gid://shopify/Product/2",
            title: "Fresh Product",
            handle: "fresh-product",
            status: "ACTIVE",
            featuredImage: null,
            variants: [],
          },
        ],
        pageInfo: {
          hasNextPage: false,
          endCursor: null,
        },
      });
    renderApp(<App initialDashboardState={readyDashboardState} searchProducts={searchProducts} />, [
      "/products",
    ]);

    fireEvent.change(screen.getByLabelText("Search products"), {
      target: { value: "old" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    fireEvent.change(screen.getByLabelText("Search products"), {
      target: { value: "fresh" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByText("Fresh Product")).toBeInTheDocument();
    });

    resolveFirstSearch?.({
      products: [
        {
          id: "gid://shopify/Product/1",
          title: "Stale Product",
          handle: "stale-product",
          status: "ACTIVE",
          featuredImage: null,
          variants: [],
        },
      ],
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
    });

    await waitFor(() => {
      expect(screen.queryByText("Stale Product")).not.toBeInTheDocument();
    });
  });

  it("renders the videos upload page and uploads a selected video", async () => {
    const uploadVideo = vi.fn().mockResolvedValue({
      video: {
        id: "video_1",
        status: "UPLOADED",
        source: "MANUAL_UPLOAD",
        originalFilename: "demo.mp4",
        contentType: "video/mp4",
        sizeBytes: 4,
      },
    });
    const file = new File([new Uint8Array([1, 2, 3, 4])], "demo.mp4", {
      type: "video/mp4",
    });
    renderApp(
      <App
        initialDashboardState={readyDashboardState}
        uploadVideo={uploadVideo}
        loadVideoLibrary={() => Promise.resolve(emptyVideoLibraryResult)}
      />,
      ["/videos"],
    );

    expect(screen.getByRole("heading", { name: "Videos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload video" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    fireEvent.change(screen.getByLabelText("Video file"), {
      target: {
        files: [file],
      },
    });

    expect(screen.getByText("demo.mp4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload video" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Upload video" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Video video_1 uploaded and is waiting for processing. It can be attached to widgets after it is ready.",
        ),
      ).toBeInTheDocument();
    });

    expect(uploadVideo).toHaveBeenCalledWith(file);
    expect(document.body.textContent).not.toContain("shopify-id-token");
    expect(document.body.textContent).not.toContain("SHOPIFY_API_SECRET");
  });

  it("shows video upload validation errors without calling the API", () => {
    const uploadVideo = vi.fn();
    const file = new File([new Uint8Array([1, 2, 3, 4])], "demo.pdf", {
      type: "application/pdf",
    });
    renderApp(
      <App
        initialDashboardState={readyDashboardState}
        uploadVideo={uploadVideo}
        loadVideoLibrary={() => Promise.resolve(emptyVideoLibraryResult)}
      />,
      ["/videos"],
    );

    fireEvent.change(screen.getByLabelText("Video file"), {
      target: {
        files: [file],
      },
    });

    expect(screen.getByText("Video file unavailable")).toBeInTheDocument();
    expect(screen.getByText("Choose an MP4, MOV, or WebM video file.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload video" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(uploadVideo).not.toHaveBeenCalled();
  });

  it("shows video upload loading and safe backend error states", async () => {
    const uploadVideo = vi.fn(
      () =>
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("raw backend upload failure")), 10);
        }),
    );
    const file = new File([new Uint8Array([1, 2, 3, 4])], "demo.mp4", {
      type: "video/mp4",
    });
    renderApp(
      <App
        initialDashboardState={readyDashboardState}
        uploadVideo={uploadVideo}
        loadVideoLibrary={() => Promise.resolve(emptyVideoLibraryResult)}
      />,
      ["/videos"],
    );

    fireEvent.change(screen.getByLabelText("Video file"), {
      target: {
        files: [file],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload video" }));

    await waitFor(() => {
      expect(screen.getByText("Uploading video")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("Video upload failed")).toBeInTheDocument();
    });

    expect(screen.getByText(VIDEO_UPLOAD_SAFE_ERROR_MESSAGE)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("raw backend upload failure");
  });

  it("renders the video upload UI and library results together", async () => {
    const loadVideoLibrary = vi.fn().mockResolvedValue({
      videos: [readyVideo],
      pageInfo: {
        hasNextPage: true,
        endCursor: "cursor-1",
      },
    });

    renderApp(
      <App
        initialDashboardState={readyDashboardState}
        uploadVideo={() => Promise.reject(new Error("unused upload client"))}
        loadVideoLibrary={loadVideoLibrary}
      />,
      ["/videos"],
    );

    expect(screen.getByRole("heading", { name: "Manual upload" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Video library" })).toBeInTheDocument();
    expect(screen.getAllByText("Loading video library").length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getByText("demo.mp4")).toBeInTheDocument();
    });

    expect(loadVideoLibrary).toHaveBeenCalledWith({
      first: 20,
      q: "",
      status: "",
      source: "",
      after: undefined,
    });
    expect(screen.getByText("video/mp4 · 4.0 MB")).toBeInTheDocument();
    expect(screen.getByText("Duration: 1:05")).toBeInTheDocument();
    expect(screen.getByText("Dimensions: 1920 x 1080")).toBeInTheDocument();
    expect(
      screen.getByText("Ready videos can be tagged and attached to widgets."),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("shopify-id-token");
    expect(document.body.textContent).not.toContain("SHOPIFY_API_SECRET");
  });

  it("renders video library empty and safe error states", async () => {
    const loadVideoLibrary = vi.fn().mockResolvedValueOnce(emptyVideoLibraryResult);

    const { rerender } = renderApp(
      <App initialDashboardState={readyDashboardState} loadVideoLibrary={loadVideoLibrary} />,
      ["/videos"],
    );

    await waitFor(() => {
      expect(screen.getByText("No videos found")).toBeInTheDocument();
    });

    rerender(
      <AppProvider i18n={enTranslations}>
        <MemoryRouter initialEntries={["/videos"]}>
          <App
            initialDashboardState={readyDashboardState}
            loadVideoLibrary={() => Promise.reject(new Error("raw filesystem path failure"))}
          />
        </MemoryRouter>
      </AppProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Video library unavailable")).toBeInTheDocument();
    });
    expect(screen.getByText(VIDEO_LIBRARY_SAFE_ERROR_MESSAGE)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("raw filesystem path failure");
  });

  it("filters and paginates the video library", async () => {
    const secondVideo: VideoLibraryItem = {
      ...readyVideo,
      id: "video_2",
      originalFilename: "second.mp4",
      status: "UPLOADED",
    };
    const loadVideoLibrary = vi
      .fn()
      .mockResolvedValueOnce({
        videos: [readyVideo],
        pageInfo: {
          hasNextPage: true,
          endCursor: "cursor-1",
        },
      })
      .mockResolvedValueOnce({
        videos: [readyVideo],
        pageInfo: {
          hasNextPage: true,
          endCursor: "cursor-2",
        },
      })
      .mockResolvedValueOnce({
        videos: [secondVideo],
        pageInfo: {
          hasNextPage: false,
          endCursor: "cursor-3",
        },
      });

    renderApp(
      <App initialDashboardState={readyDashboardState} loadVideoLibrary={loadVideoLibrary} />,
      ["/videos"],
    );

    await waitFor(() => {
      expect(screen.getByText("demo.mp4")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Search videos"), {
      target: { value: "demo" },
    });
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "READY" },
    });
    fireEvent.change(screen.getByLabelText("Source"), {
      target: { value: "MANUAL_UPLOAD" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => {
      expect(loadVideoLibrary).toHaveBeenLastCalledWith({
        q: "demo",
        status: "READY",
        source: "MANUAL_UPLOAD",
        first: 20,
        after: undefined,
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Load more videos" }));

    await waitFor(() => {
      expect(screen.getByText("second.mp4")).toBeInTheDocument();
    });
    expect(loadVideoLibrary).toHaveBeenLastCalledWith({
      q: "demo",
      status: "READY",
      source: "MANUAL_UPLOAD",
      first: 20,
      after: "cursor-2",
    });
  });

  it("loads video detail and archives videos safely", async () => {
    const archivedVideo: VideoLibraryItem = {
      ...readyVideo,
      status: "ARCHIVED",
      updatedAt: "2026-05-23T00:10:00.000Z",
    };
    const loadVideoLibrary = vi.fn().mockResolvedValue({
      videos: [readyVideo],
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
    });
    const loadVideoDetail = vi.fn().mockResolvedValue(readyVideo);
    const archiveVideo = vi.fn().mockResolvedValue(archivedVideo);

    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );

    renderApp(
      <App
        initialDashboardState={readyDashboardState}
        loadVideoLibrary={loadVideoLibrary}
        loadVideoDetail={loadVideoDetail}
        archiveVideo={archiveVideo}
        loadVideoProductTags={() => Promise.resolve(emptyVideoTagsResult)}
      />,
      ["/videos"],
    );

    await waitFor(() => {
      expect(screen.getByText("demo.mp4")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "View details" }));

    await waitFor(() => {
      expect(screen.getByText("Video details")).toBeInTheDocument();
    });
    expect(loadVideoDetail).toHaveBeenCalledWith("video_1");
    expect(screen.getByText("ID: video_1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => {
      expect(archiveVideo).toHaveBeenCalledWith("video_1");
    });
    expect(screen.getAllByText("ARCHIVED").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain("DATABASE_URL");
    expect(document.body.textContent).not.toContain("/tmp/shoppable-video-storage");
  });

  it("opens uploaded video details immediately while detail refresh is pending", async () => {
    const uploadedVideo: VideoLibraryItem = {
      ...readyVideo,
      id: "video_uploaded",
      status: "UPLOADED",
      durationMs: null,
      width: null,
      height: null,
      updatedAt: "2026-05-23T00:07:00.000Z",
    };
    let resolveDetail: (video: VideoLibraryItem) => void = () => undefined;
    const loadVideoLibrary = vi.fn().mockResolvedValue({
      videos: [uploadedVideo],
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
    });
    const loadVideoDetail = vi.fn(
      () =>
        new Promise<VideoLibraryItem>((resolve) => {
          resolveDetail = resolve;
        }),
    );
    const loadVideoProductTags = vi.fn().mockResolvedValue(emptyVideoTagsResult);

    renderApp(
      <App
        initialDashboardState={readyDashboardState}
        loadVideoLibrary={loadVideoLibrary}
        loadVideoDetail={loadVideoDetail}
        loadVideoProductTags={loadVideoProductTags}
      />,
      ["/videos"],
    );

    await waitFor(() => {
      expect(screen.getByText("demo.mp4")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "View details" }));

    expect(loadVideoDetail).toHaveBeenCalledWith("video_uploaded");
    await waitFor(() => {
      expect(screen.getByText("Video details")).toBeInTheDocument();
    });
    expect(screen.getByText("ID: video_uploaded")).toBeInTheDocument();
    expect(screen.getByText("Status: UPLOADED")).toBeInTheDocument();
    expect(screen.getByText("Video not ready for product tags")).toBeInTheDocument();
    expect(loadVideoProductTags).not.toHaveBeenCalled();

    resolveDetail(uploadedVideo);
  });

  it("retries processing for uploaded and failed manual videos", async () => {
    const failedVideo: VideoLibraryItem = {
      ...readyVideo,
      status: "FAILED",
      updatedAt: "2026-05-23T00:10:00.000Z",
    };
    const retriedVideo: VideoLibraryItem = {
      ...failedVideo,
      status: "READY",
      durationMs: 65000,
    };
    const retryVideoProcessing = vi.fn().mockResolvedValue(retriedVideo);

    renderApp(
      <App
        initialDashboardState={readyDashboardState}
        loadVideoLibrary={() =>
          Promise.resolve({
            videos: [failedVideo],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
          })
        }
        retryVideoProcessing={retryVideoProcessing}
      />,
      ["/videos"],
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "Processing failed. Retry processing before attaching this video to a widget.",
        ),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Retry processing" }));

    await waitFor(() => {
      expect(retryVideoProcessing).toHaveBeenCalledWith("video_1");
    });
    expect(
      screen.getByText("Ready videos can be tagged and attached to widgets."),
    ).toBeInTheDocument();
  });

  it("loads tags and adds a variant-level product tag from product search", async () => {
    const loadVideoLibrary = vi.fn().mockResolvedValue({
      videos: [readyVideo],
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
    });
    const loadVideoProductTags = vi.fn().mockResolvedValue(emptyVideoTagsResult);
    const createVideoProductTag = vi.fn().mockResolvedValue(readyVideoTag);
    const searchProducts = vi.fn().mockResolvedValue({
      products: [
        {
          id: "gid://shopify/Product/1",
          title: "Linen Shirt",
          handle: "linen-shirt",
          status: "ACTIVE",
          featuredImage: null,
          variants: [
            {
              id: "gid://shopify/ProductVariant/1",
              title: "Small",
              sku: "LINEN-S",
              price: "24.00",
              inventoryQuantity: 7,
            },
          ],
        },
      ],
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
    });

    renderApp(
      <App
        initialDashboardState={readyDashboardState}
        loadVideoLibrary={loadVideoLibrary}
        loadVideoDetail={() => Promise.resolve(readyVideo)}
        loadVideoProductTags={loadVideoProductTags}
        createVideoProductTag={createVideoProductTag}
        searchProducts={searchProducts}
      />,
      ["/videos"],
    );

    await waitFor(() => {
      expect(screen.getByText("demo.mp4")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "View details" }));

    await waitFor(() => {
      expect(loadVideoProductTags).toHaveBeenCalledWith("video_1");
    });
    expect(screen.getByText("Product tags")).toBeInTheDocument();
    expect(screen.getByText("No product variants are tagged yet.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search products to tag"), {
      target: { value: "linen" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search products" }));

    await waitFor(() => {
      expect(screen.getByText("Linen Shirt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Tag variant" }));

    await waitFor(() => {
      expect(createVideoProductTag).toHaveBeenCalledWith("video_1", {
        productId: "gid://shopify/Product/1",
        productTitle: "Linen Shirt",
        productHandle: "linen-shirt",
        variantId: "gid://shopify/ProductVariant/1",
        variantTitle: "Small",
        sku: "LINEN-S",
      });
    });
    expect(screen.getByRole("button", { name: "Tagged" })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("shopify-id-token");
    expect(document.body.textContent).not.toContain("DATABASE_URL");
  });

  it("loads existing product tags and removes one safely", async () => {
    const loadVideoProductTags = vi.fn().mockResolvedValue({
      tags: [readyVideoTag],
    });
    const deleteVideoProductTag = vi.fn().mockResolvedValue({ deleted: true });

    renderApp(
      <App
        initialDashboardState={readyDashboardState}
        loadVideoLibrary={() =>
          Promise.resolve({
            videos: [readyVideo],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
          })
        }
        loadVideoDetail={() => Promise.resolve(readyVideo)}
        loadVideoProductTags={loadVideoProductTags}
        deleteVideoProductTag={deleteVideoProductTag}
      />,
      ["/videos"],
    );

    await waitFor(() => {
      expect(screen.getByText("demo.mp4")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "View details" }));

    await waitFor(() => {
      expect(screen.getByText("Variant: Small")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove tag" }));

    await waitFor(() => {
      expect(screen.getByText("Remove product tag?")).toBeInTheDocument();
    });
    const removeTagButtons = screen.getAllByRole("button", { name: "Remove tag" });
    const modalRemoveButton = removeTagButtons[removeTagButtons.length - 1];

    if (!modalRemoveButton) {
      throw new Error("Expected modal remove tag button");
    }

    fireEvent.click(modalRemoveButton);

    await waitFor(() => {
      expect(deleteVideoProductTag).toHaveBeenCalledWith("video_1", "tag_1");
    });
    await waitFor(() => {
      expect(screen.queryByText("Variant: Small")).not.toBeInTheDocument();
    });
  });

  it("shows safe tagging errors and does not allow product-only tags", async () => {
    const searchProducts = vi.fn().mockResolvedValue({
      products: [
        {
          id: "gid://shopify/Product/2",
          title: "Hat",
          handle: "hat",
          status: "ACTIVE",
          featuredImage: null,
          variants: [],
        },
      ],
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
    });

    renderApp(
      <App
        initialDashboardState={readyDashboardState}
        loadVideoLibrary={() =>
          Promise.resolve({
            videos: [readyVideo],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
          })
        }
        loadVideoDetail={() => Promise.resolve(readyVideo)}
        loadVideoProductTags={() => Promise.reject(new Error("raw tag backend failure"))}
        searchProducts={searchProducts}
      />,
      ["/videos"],
    );

    await waitFor(() => {
      expect(screen.getByText("demo.mp4")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "View details" }));

    await waitFor(() => {
      expect(screen.getByText("Product tags unavailable")).toBeInTheDocument();
    });
    expect(screen.getByText(VIDEO_PRODUCT_TAGS_SAFE_ERROR_MESSAGE)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("raw tag backend failure");

    fireEvent.change(screen.getByLabelText("Search products to tag"), {
      target: { value: "hat" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search products" }));

    await waitFor(() => {
      expect(screen.getByText("No variants to tag.")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Tag variant" })).not.toBeInTheDocument();
  });

  it("blocks tagging controls for archived videos", async () => {
    const archivedVideo: VideoLibraryItem = {
      ...readyVideo,
      status: "ARCHIVED",
    };

    renderApp(
      <App
        initialDashboardState={readyDashboardState}
        loadVideoLibrary={() =>
          Promise.resolve({
            videos: [archivedVideo],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
          })
        }
        loadVideoDetail={() => Promise.resolve(archivedVideo)}
        loadVideoProductTags={() => Promise.resolve(emptyVideoTagsResult)}
      />,
      ["/videos"],
    );

    await waitFor(() => {
      expect(screen.getByText("demo.mp4")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "View details" }));

    await waitFor(() => {
      expect(screen.getByText("Archived videos cannot be tagged.")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Search products" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("renders the widgets page and creates a widget", async () => {
    const loadWidgets = vi.fn().mockResolvedValue({ widgets: [] });
    const createWidget = vi.fn().mockResolvedValue(readyWidget);

    renderApp(
      <App
        initialDashboardState={readyDashboardState}
        loadWidgets={loadWidgets}
        createWidget={createWidget}
        loadVideoLibrary={() => Promise.resolve(emptyVideoLibraryResult)}
      />,
      ["/widgets"],
    );

    expect(screen.getByRole("heading", { name: "Widgets" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("No widgets yet")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Widget title"), {
      target: { value: "Homepage videos" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create widget" }));

    await waitFor(() => {
      expect(createWidget).toHaveBeenCalledWith({ title: "Homepage videos" });
    });
    expect(screen.getByText("Homepage videos")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("shopify-id-token");
    expect(document.body.textContent).not.toContain("SHOPIFY_API_SECRET");
  });

  it("renders widget details, embed snippet, and attaches or detaches videos", async () => {
    const attachedWidget: AdminWidget = {
      ...readyWidget,
      videos: [readyVideo],
    };
    const loadWidgets = vi.fn().mockResolvedValue({ widgets: [readyWidget] });
    const loadWidgetDetail = vi
      .fn()
      .mockResolvedValueOnce(readyWidget)
      .mockResolvedValueOnce(readyWidget);
    const updateWidget = vi.fn().mockResolvedValue({
      ...readyWidget,
      title: "Homepage carousel",
      status: "PUBLISHED",
    });
    const attachWidgetVideo = vi.fn().mockResolvedValue(attachedWidget);
    const detachWidgetVideo = vi.fn().mockResolvedValue({ detached: true });
    const loadVideoLibrary = vi.fn().mockResolvedValue({
      videos: [readyVideo],
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
    });

    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );

    renderApp(
      <App
        initialDashboardState={readyDashboardState}
        loadWidgets={loadWidgets}
        loadWidgetDetail={loadWidgetDetail}
        updateWidget={updateWidget}
        attachWidgetVideo={attachWidgetVideo}
        detachWidgetVideo={detachWidgetVideo}
        loadVideoLibrary={loadVideoLibrary}
      />,
      ["/widgets"],
    );

    await waitFor(() => {
      expect(screen.getByText("Homepage videos")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "View details" }));

    await waitFor(() => {
      expect(screen.getByText("Widget details")).toBeInTheDocument();
    });
    expect(loadWidgetDetail).toHaveBeenCalledWith("widget_1");
    expect(loadVideoLibrary).toHaveBeenCalledWith({
      first: 50,
      source: "MANUAL_UPLOAD",
    });
    expect(screen.getByLabelText("Widget embed snippet").textContent).toContain(
      "http://localhost:3000/widget.js",
    );
    expect(screen.getByLabelText("Widget embed snippet").textContent).toContain(
      'data-shop="test-shop.myshopify.com"',
    );

    const widgetTitleInputs = screen.getAllByLabelText("Widget title");

    fireEvent.change(widgetTitleInputs[1]!, {
      target: { value: "Homepage carousel" },
    });
    fireEvent.change(screen.getByLabelText("Widget status"), {
      target: { value: "PUBLISHED" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save widget" }));

    await waitFor(() => {
      expect(updateWidget).toHaveBeenCalledWith("widget_1", {
        title: "Homepage carousel",
        status: "PUBLISHED",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Attach video" }));

    await waitFor(() => {
      expect(attachWidgetVideo).toHaveBeenCalledWith("widget_1", "video_1");
    });
    expect(screen.getByRole("button", { name: "Attached" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Detach" }));

    await waitFor(() => {
      expect(detachWidgetVideo).toHaveBeenCalledWith("widget_1", "video_1");
    });
    expect(document.body.textContent).not.toContain("DATABASE_URL");
    expect(document.body.textContent).not.toContain("/tmp/shoppable-video-storage");
  });

  it("shows unavailable widget video candidates without enabling attach", async () => {
    const failedVideo: VideoLibraryItem = {
      ...readyVideo,
      status: "FAILED",
      originalFilename: "failed.mp4",
    };

    renderApp(
      <App
        initialDashboardState={readyDashboardState}
        loadWidgets={() => Promise.resolve({ widgets: [readyWidget] })}
        loadWidgetDetail={() => Promise.resolve(readyWidget)}
        loadVideoLibrary={() =>
          Promise.resolve({
            videos: [failedVideo],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
          })
        }
      />,
      ["/widgets"],
    );

    await waitFor(() => {
      expect(screen.getByText("Homepage videos")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "View details" }));

    await waitFor(() => {
      expect(screen.getByText("Uploaded videos not ready yet")).toBeInTheDocument();
    });
    expect(screen.getByText("failed.mp4")).toBeInTheDocument();
    expect(screen.getByText("Retry processing from Videos before attaching.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Attach video" })).not.toBeInTheDocument();
  });

  it("renders safe widget errors without exposing raw backend details", async () => {
    renderApp(
      <App
        initialDashboardState={readyDashboardState}
        loadWidgets={() => Promise.reject(new Error("raw widget backend failure"))}
      />,
      ["/widgets"],
    );

    await waitFor(() => {
      expect(screen.getByText("Widgets unavailable")).toBeInTheDocument();
    });
    expect(
      screen.getByText("We could not update widgets. Reload the app from Shopify admin."),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("raw widget backend failure");
  });
});
