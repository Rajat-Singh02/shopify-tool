import { Banner, BlockStack, Page } from "@shopify/polaris";
import type { PropsWithChildren } from "react";
import { Component } from "react";

import { logger } from "../lib/logger";

type State = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<PropsWithChildren, State> {
  override state: State = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error) {
    logger.error({ error }, "Unhandled React app error");
  }

  override render() {
    if (this.state.error) {
      return (
        <Page title="Something went wrong">
          <BlockStack gap="400">
            <Banner tone="critical" title="The app could not render this screen">
              Reload the page. If the problem continues, check the application logs.
            </Banner>
          </BlockStack>
        </Page>
      );
    }

    return this.props.children;
  }
}
