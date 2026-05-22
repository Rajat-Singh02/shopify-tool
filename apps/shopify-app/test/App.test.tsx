import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { App } from "../app/App";
import { ADMIN_SHELL_SAFE_ERROR_MESSAGE } from "../services/admin-shell";

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

function renderApp(app: ReactElement) {
  return render(
    <AppProvider i18n={enTranslations}>
      <MemoryRouter initialEntries={["/"]}>{app}</MemoryRouter>
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
});
