import { Frame } from "@shopify/polaris";
import { Route, Routes } from "react-router";

import { AppErrorBoundary } from "../components/AppErrorBoundary";
import { AppNavigation } from "../components/AppNavigation";
import { DashboardPage } from "../routes/DashboardPage";

export function App() {
  return (
    <AppErrorBoundary>
      <Frame navigation={<AppNavigation />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
        </Routes>
      </Frame>
    </AppErrorBoundary>
  );
}
