import { randomUUID } from "node:crypto";

export type VideoProductTagRecord = {
  id: string;
  shopId: string;
  videoId: string;
  shopifyProductId: string;
  shopifyVariantId: string;
  productTitleSnapshot: string;
  variantTitleSnapshot: string | null;
  productImageUrlSnapshot: string | null;
  priceSnapshot: unknown;
  currencyCodeSnapshot: string | null;
  position: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type VideoProductTagWhereInput = {
  id?: string;
  shopId?: string;
  videoId?: string;
  shopifyProductId?: string;
  shopifyVariantId?: string;
  isActive?: boolean;
};

export type VideoProductTagRepositoryClient = {
  videoProductTag: {
    findMany(args: {
      where: VideoProductTagWhereInput;
      orderBy: Array<{ position: "asc" } | { createdAt: "asc" }>;
    }): Promise<VideoProductTagRecord[]>;
    findFirst(args: { where: VideoProductTagWhereInput }): Promise<VideoProductTagRecord | null>;
    create(args: {
      data: {
        id: string;
        shopId: string;
        videoId: string;
        shopifyProductId: string;
        shopifyVariantId: string;
        productTitleSnapshot: string;
        variantTitleSnapshot: string | null;
        position: number;
        isActive: boolean;
      };
    }): Promise<VideoProductTagRecord>;
    update(args: {
      where: { id: string };
      data:
        | {
            productTitleSnapshot: string;
            variantTitleSnapshot: string | null;
            isActive: true;
          }
        | {
            isActive: false;
          };
    }): Promise<VideoProductTagRecord>;
  };
};

export type UpsertVideoProductTagInput = {
  shopId: string;
  videoId: string;
  shopifyProductId: string;
  shopifyVariantId: string;
  productTitleSnapshot: string;
  variantTitleSnapshot: string | null;
};

export class VideoProductTagRepository {
  constructor(private readonly client: VideoProductTagRepositoryClient) {}

  async listActiveByVideo(shopId: string, videoId: string): Promise<VideoProductTagRecord[]> {
    return this.client.videoProductTag.findMany({
      where: {
        shopId,
        videoId,
        isActive: true,
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
  }

  async upsertActive(input: UpsertVideoProductTagInput): Promise<VideoProductTagRecord> {
    const existingTag = await this.client.videoProductTag.findFirst({
      where: {
        shopId: input.shopId,
        videoId: input.videoId,
        shopifyProductId: input.shopifyProductId,
        shopifyVariantId: input.shopifyVariantId,
      },
    });

    if (existingTag) {
      return this.client.videoProductTag.update({
        where: {
          id: existingTag.id,
        },
        data: {
          productTitleSnapshot: input.productTitleSnapshot,
          variantTitleSnapshot: input.variantTitleSnapshot,
          isActive: true,
        },
      });
    }

    return this.client.videoProductTag.create({
      data: {
        id: randomUUID(),
        shopId: input.shopId,
        videoId: input.videoId,
        shopifyProductId: input.shopifyProductId,
        shopifyVariantId: input.shopifyVariantId,
        productTitleSnapshot: input.productTitleSnapshot,
        variantTitleSnapshot: input.variantTitleSnapshot,
        position: 0,
        isActive: true,
      },
    });
  }

  async deactivateByVideo(
    shopId: string,
    videoId: string,
    tagId: string,
  ): Promise<VideoProductTagRecord | null> {
    const existingTag = await this.client.videoProductTag.findFirst({
      where: {
        id: tagId,
        shopId,
        videoId,
        isActive: true,
      },
    });

    if (!existingTag) {
      return null;
    }

    return this.client.videoProductTag.update({
      where: {
        id: existingTag.id,
      },
      data: {
        isActive: false,
      },
    });
  }
}
