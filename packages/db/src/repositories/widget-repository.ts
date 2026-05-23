import { randomUUID } from "node:crypto";

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

export type AdminWidgetRecord = WidgetRecord & {
  widgetVideos: Array<{
    id: string;
    videoId: string;
    position: number;
    createdAt: Date;
    video: VideoRecord;
  }>;
};

type WidgetWhereInput = {
  id?: string;
  shopId?: string;
  status?: WidgetStatus;
  shop?: {
    shopDomain: string;
    uninstalledAt: null;
  };
};

export type WidgetRepositoryClient = {
  widget: {
    create(args: {
      data: {
        id: string;
        shopId: string;
        name: string;
        status: WidgetStatus;
        layout: WidgetLayout;
        settingsJson: Record<string, never>;
      };
      include: AdminWidgetInclude;
    }): Promise<AdminWidgetRecord>;
    findFirst(args: {
      where: WidgetWhereInput;
      include: StorefrontWidgetInclude;
    }): Promise<StorefrontWidgetRecord | null>;
    findMany(args: {
      where: {
        shopId: string;
      };
      orderBy: Array<{ createdAt: "desc" } | { id: "desc" }>;
      include: AdminWidgetInclude;
    }): Promise<AdminWidgetRecord[]>;
    findUnique(args: {
      where: {
        id: string;
      };
      include: AdminWidgetInclude;
    }): Promise<AdminWidgetRecord | null>;
    update(args: {
      where: {
        id: string;
      };
      data: {
        name?: string;
        status?: WidgetStatus;
      };
      include: AdminWidgetInclude;
    }): Promise<AdminWidgetRecord>;
  };
  widgetVideo: {
    findFirst(args: {
      where: {
        shopId: string;
        widgetId: string;
        videoId: string;
      };
      include: {
        video: true;
      };
    }): Promise<(AdminWidgetRecord["widgetVideos"][number]) | null>;
    create(args: {
      data: {
        id: string;
        shopId: string;
        widgetId: string;
        videoId: string;
        position: number;
      };
      include: {
        video: true;
      };
    }): Promise<AdminWidgetRecord["widgetVideos"][number]>;
    deleteMany(args: {
      where: {
        shopId: string;
        widgetId: string;
        videoId: string;
      };
    }): Promise<{ count: number }>;
  };
};

type StorefrontWidgetInclude = {
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

type AdminWidgetInclude = {
  widgetVideos: {
    orderBy: Array<{ position: "asc" } | { createdAt: "asc" }>;
    include: {
      video: true;
    };
  };
};

export class WidgetRepository {
  constructor(private readonly client: WidgetRepositoryClient) {}

  async listByShop(shopId: string): Promise<AdminWidgetRecord[]> {
    return this.client.widget.findMany({
      where: {
        shopId,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: createAdminWidgetInclude(),
    });
  }

  async createForShop(shopId: string, name: string): Promise<AdminWidgetRecord> {
    return this.client.widget.create({
      data: {
        id: randomUUID(),
        shopId,
        name,
        status: "DRAFT",
        layout: "INLINE_CAROUSEL",
        settingsJson: {},
      },
      include: createAdminWidgetInclude(),
    });
  }

  async findByShop(shopId: string, widgetId: string): Promise<AdminWidgetRecord | null> {
    const widget = await this.client.widget.findUnique({
      where: {
        id: widgetId,
      },
      include: createAdminWidgetInclude(),
    });

    return widget?.shopId === shopId ? widget : null;
  }

  async updateByShop(
    shopId: string,
    widgetId: string,
    data: { name?: string; status?: WidgetStatus },
  ): Promise<AdminWidgetRecord | null> {
    const widget = await this.findByShop(shopId, widgetId);

    if (!widget) {
      return null;
    }

    return this.client.widget.update({
      where: {
        id: widgetId,
      },
      data,
      include: createAdminWidgetInclude(),
    });
  }

  async attachVideo(
    shopId: string,
    widgetId: string,
    video: VideoRecord,
    position = 0,
  ): Promise<AdminWidgetRecord["widgetVideos"][number]> {
    const existing = await this.client.widgetVideo.findFirst({
      where: {
        shopId,
        widgetId,
        videoId: video.id,
      },
      include: {
        video: true,
      },
    });

    if (existing) {
      return existing;
    }

    return this.client.widgetVideo.create({
      data: {
        id: randomUUID(),
        shopId,
        widgetId,
        videoId: video.id,
        position,
      },
      include: {
        video: true,
      },
    });
  }

  async detachVideo(shopId: string, widgetId: string, videoId: string): Promise<{ detached: true }> {
    await this.client.widgetVideo.deleteMany({
      where: {
        shopId,
        widgetId,
        videoId,
      },
    });

    return {
      detached: true,
    };
  }

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

function createAdminWidgetInclude(): AdminWidgetInclude {
  return {
    widgetVideos: {
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: {
        video: true,
      },
    },
  };
}
