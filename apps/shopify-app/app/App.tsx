import { Frame } from "@shopify/polaris";
import { useEffect, useState } from "react";
import { Route, Routes } from "react-router";

import { AppErrorBoundary } from "../components/AppErrorBoundary";
import { AppNavigation } from "../components/AppNavigation";
import { DashboardPage } from "../routes/DashboardPage";
import { ProductsPage } from "../routes/ProductsPage";
import { VideosPage } from "../routes/VideosPage";
import {
  ADMIN_SHELL_SAFE_ERROR_MESSAGE,
  fetchAdminDashboardContext,
  type AdminDashboardContextLoader,
  type AdminDashboardState,
} from "../services/admin-shell";
import type { ProductSearchClient } from "../services/product-search";
import type { VideoUploadClient } from "../services/video-upload";

type AppProps = {
  initialDashboardState?: AdminDashboardState;
  loadDashboardContext?: AdminDashboardContextLoader;
  searchProducts?: ProductSearchClient;
  uploadVideo?: VideoUploadClient;
};

export function App({
  initialDashboardState,
  loadDashboardContext = fetchAdminDashboardContext,
  searchProducts,
  uploadVideo,
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
          <Route path="/videos" element={<VideosPage uploadVideo={uploadVideo} />} />
        </Routes>
      </Frame>
    </AppErrorBoundary>
  );
}
