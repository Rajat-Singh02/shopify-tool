import type { VideoProductTagRecord } from "./video-product-tag-repository.js";
import type { VideoRecord } from "./video-repository.js";

export type WidgetStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type WidgetLayout = "INLINE_CAROUSEL";

export type WidgetRecord = {
  id: string;
  shopId: string;
  name: string;
  status: WidgetStatus;
  layout: WidgetLayout;
  settingsJson: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type WidgetVideoRecord = {
  id: string;
  shopId: string;
  widgetId: string;
  videoId: string;
  position: number;
  createdAt: Date;
  video: VideoRecord & {
    productTags: VideoProductTagRecord[];
  };
};

export type StorefrontWidgetRecord = WidgetRecord & {
  shop: {
    shopDomain: string;
  };
  widgetVideos: WidgetVideoRecord[];
};

type WidgetWhereInput = {
  id: string;
  status: WidgetStatus;
  shop: {
    shopDomain: string;
    uninstalledAt: null;
  };
};

export type WidgetRepositoryClient = {
  widget: {
    findFirst(args: {
      where: WidgetWhereInput;
      include: {
        shop: {
          select: {
            shopDomain: true;
          };
        };
        widgetVideos: {
          orderBy: Array<{ position: "asc" } | { createdAt: "asc" }>;
          include: {
            video: {
              include: {
                productTags: {
                  where: {
                    isActive: true;
                  };
                  orderBy: Array<{ position: "asc" } | { createdAt: "asc" }>;
                };
              };
            };
          };
        };
      };
    }): Promise<StorefrontWidgetRecord | null>;
  };
};

export class WidgetRepository {
  constructor(private readonly client: WidgetRepositoryClient) {}

  async findPublishedStorefrontWidget(
    shopDomain: string,
    widgetId: string,
  ): Promise<StorefrontWidgetRecord | null> {
    return this.client.widget.findFirst({
      where: {
        id: widgetId,
        status: "PUBLISHED",
        shop: {
          shopDomain,
          uninstalledAt: null,
        },
      },
      include: {
        shop: {
          select: {
            shopDomain: true,
          },
        },
        widgetVideos: {
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          include: {
            video: {
              include: {
                productTags: {
                  where: {
                    isActive: true,
                  },
                  orderBy: [{ position: "asc" }, { createdAt: "asc" }],
                },
              },
            },
          },
        },
      },
    });
  }
}
