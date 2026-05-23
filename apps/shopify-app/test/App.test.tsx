import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../app/App";
import { ADMIN_SHELL_SAFE_ERROR_MESSAGE } from "../services/admin-shell";
import { PRODUCT_SEARCH_SAFE_ERROR_MESSAGE } from "../services/product-search";
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
});

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
    renderApp(
      <App initialDashboardState={readyDashboardState} searchProducts={searchProducts} />,
      ["/products"],
    );

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
    renderApp(
      <App initialDashboardState={readyDashboardState} searchProducts={searchProducts} />,
      ["/products"],
    );

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
    renderApp(
      <App initialDashboardState={readyDashboardState} searchProducts={searchProducts} />,
      ["/products"],
    );

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
      <App initialDashboardState={readyDashboardState} uploadVideo={uploadVideo} />,
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
      expect(screen.getByText("Video video_1 is UPLOADED.")).toBeInTheDocument();
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
      <App initialDashboardState={readyDashboardState} uploadVideo={uploadVideo} />,
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
      <App initialDashboardState={readyDashboardState} uploadVideo={uploadVideo} />,
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
});
