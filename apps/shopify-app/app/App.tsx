import { Frame } from "@shopify/polaris";
import { useEffect, useState } from "react";
import { Route, Routes } from "react-router";

import { AppErrorBoundary } from "../components/AppErrorBoundary";
import { AppNavigation } from "../components/AppNavigation";
import { DashboardPage } from "../routes/DashboardPage";
import { ProductsPage } from "../routes/ProductsPage";
import { VideosPage } from "../routes/VideosPage";
import { WidgetsPage } from "../routes/WidgetsPage";
import {
  ADMIN_SHELL_SAFE_ERROR_MESSAGE,
  fetchAdminDashboardContext,
  type AdminDashboardContextLoader,
  type AdminDashboardState,
} from "../services/admin-shell";
import type {
  AdminWidgetAttachVideoClient,
  AdminWidgetCreateClient,
  AdminWidgetDetachVideoClient,
  AdminWidgetDetailClient,
  AdminWidgetListClient,
  AdminWidgetUpdateClient,
} from "../services/admin-widgets";
import type { ProductSearchClient } from "../services/product-search";
import type {
  VideoArchiveClient,
  VideoDetailClient,
  VideoLibraryClient,
} from "../services/video-library";
import type {
  CreateVideoProductTagClient,
  DeleteVideoProductTagClient,
  VideoProductTagsClient,
} from "../services/video-product-tags";
import type { VideoUploadClient } from "../services/video-upload";

type AppProps = {
  initialDashboardState?: AdminDashboardState;
  loadDashboardContext?: AdminDashboardContextLoader;
  searchProducts?: ProductSearchClient;
  loadVideoLibrary?: VideoLibraryClient;
  loadVideoDetail?: VideoDetailClient;
  archiveVideo?: VideoArchiveClient;
  loadVideoProductTags?: VideoProductTagsClient;
  createVideoProductTag?: CreateVideoProductTagClient;
  deleteVideoProductTag?: DeleteVideoProductTagClient;
  uploadVideo?: VideoUploadClient;
  loadWidgets?: AdminWidgetListClient;
  createWidget?: AdminWidgetCreateClient;
  loadWidgetDetail?: AdminWidgetDetailClient;
  updateWidget?: AdminWidgetUpdateClient;
  attachWidgetVideo?: AdminWidgetAttachVideoClient;
  detachWidgetVideo?: AdminWidgetDetachVideoClient;
};

export function App({
  initialDashboardState,
  loadDashboardContext = fetchAdminDashboardContext,
  searchProducts,
  loadVideoLibrary,
  loadVideoDetail,
  archiveVideo,
  loadVideoProductTags,
  createVideoProductTag,
  deleteVideoProductTag,
  uploadVideo,
  loadWidgets,
  createWidget,
  loadWidgetDetail,
  updateWidget,
  attachWidgetVideo,
  detachWidgetVideo,
}: AppProps) {
  const [dashboardState, setDashboardState] = useState<AdminDashboardState>(
    initialDashboardState ?? { status: "loading" },
  );

  useEffect(() => {
    if (initialDashboardState) {
      return undefined;
    }

    let isMounted = true;

    loadDashboardContext()
      .then((data) => {
        if (isMounted) {
          setDashboardState({ status: "ready", data });
        }
      })
      .catch(() => {
        if (isMounted) {
          setDashboardState({
            status: "error",
            message: ADMIN_SHELL_SAFE_ERROR_MESSAGE,
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [initialDashboardState, loadDashboardContext]);

  return (
    <AppErrorBoundary>
      <Frame navigation={<AppNavigation />}>
        <Routes>
          <Route path="/" element={<DashboardPage dashboardState={dashboardState} />} />
          <Route path="/products" element={<ProductsPage searchProducts={searchProducts} />} />
          <Route
            path="/videos"
            element={
              <VideosPage
                uploadVideo={uploadVideo}
                loadVideoLibrary={loadVideoLibrary}
                loadVideoDetail={loadVideoDetail}
                archiveVideo={archiveVideo}
                searchProducts={searchProducts}
                loadVideoProductTags={loadVideoProductTags}
                createVideoProductTag={createVideoProductTag}
                deleteVideoProductTag={deleteVideoProductTag}
              />
            }
          />
          <Route
            path="/widgets"
            element={
              <WidgetsPage
                shopDomain={
                  dashboardState.status === "ready" ? dashboardState.data.shop.domain : undefined
                }
                loadWidgets={loadWidgets}
                createWidget={createWidget}
                loadWidgetDetail={loadWidgetDetail}
                updateWidget={updateWidget}
                attachVideo={attachWidgetVideo}
                detachVideo={detachWidgetVideo}
                loadVideoLibrary={loadVideoLibrary}
              />
            }
          />
        </Routes>
      </Frame>
    </AppErrorBoundary>
  );
}
