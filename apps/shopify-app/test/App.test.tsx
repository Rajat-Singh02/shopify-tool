import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { App } from "../app/App";

describe("admin app shell", () => {
  it("renders the empty dashboard", () => {
    render(
      <AppProvider i18n={enTranslations}>
        <MemoryRouter initialEntries={["/"]}>
          <App />
        </MemoryRouter>
      </AppProvider>,
    );

    expect(screen.getByRole("heading", { name: "Shoppable Video" })).toBeInTheDocument();
    expect(screen.getByText("Manual upload only")).toBeInTheDocument();
  });
});
