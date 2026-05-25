export type VideoStorageObjectRecord = {
  key: string;
  contentType: string;
  sizeBytes: bigint;
  body: Uint8Array;
  createdAt: Date;
  updatedAt: Date;
};

export type VideoStorageObjectRepositoryClient = {
  videoStorageObject: {
    upsert(args: {
      where: { key: string };
      create: {
        key: string;
        contentType: string;
        sizeBytes: bigint;
        body: Uint8Array<ArrayBuffer>;
      };
      update: {
        contentType: string;
        sizeBytes: bigint;
        body: Uint8Array<ArrayBuffer>;
      };
    }): Promise<VideoStorageObjectRecord>;
    findUnique(args: {
      where: { key: string };
      select?: {
        key?: boolean;
        contentType?: boolean;
        sizeBytes?: boolean;
        body?: boolean;
      };
    }): Promise<Partial<VideoStorageObjectRecord> | null>;
  };
};

export type WriteVideoStorageObjectInput = {
  key: string;
  contentType: string;
  body: Uint8Array;
};

export type ReadVideoStorageObjectResult = {
  key: string;
  contentType: string;
  sizeBytes: number;
  body: Uint8Array;
};

export class VideoStorageObjectRepository {
  constructor(private readonly client: VideoStorageObjectRepositoryClient) {}

  async writeObject(input: WriteVideoStorageObjectInput): Promise<void> {
    const body = copyToPrismaBytes(input.body);

    await this.client.videoStorageObject.upsert({
      where: {
        key: input.key,
      },
      create: {
        key: input.key,
        contentType: input.contentType,
        sizeBytes: BigInt(body.byteLength),
        body,
      },
      update: {
        contentType: input.contentType,
        sizeBytes: BigInt(body.byteLength),
        body,
      },
    });
  }

  async objectExists(key: string): Promise<boolean> {
    const object = await this.client.videoStorageObject.findUnique({
      where: {
        key,
      },
      select: {
        key: true,
      },
    });

    return Boolean(object);
  }

  async objectSize(key: string): Promise<number | null> {
    const object = await this.client.videoStorageObject.findUnique({
      where: {
        key,
      },
      select: {
        sizeBytes: true,
      },
    });

    if (!object?.sizeBytes) {
      return null;
    }

    const size = Number(object.sizeBytes);

    return Number.isSafeInteger(size) ? size : null;
  }

  async readObject(key: string): Promise<ReadVideoStorageObjectResult | null> {
    const object = await this.client.videoStorageObject.findUnique({
      where: {
        key,
      },
      select: {
        key: true,
        contentType: true,
        sizeBytes: true,
        body: true,
      },
    });

    if (!object?.key || !object.contentType || !object.sizeBytes || !object.body) {
      return null;
    }

    const sizeBytes = Number(object.sizeBytes);

    if (!Number.isSafeInteger(sizeBytes)) {
      return null;
    }

    return {
      key: object.key,
      contentType: object.contentType,
      sizeBytes,
      body: object.body,
    };
  }
}

function copyToPrismaBytes(body: Uint8Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(body.byteLength);

  bytes.set(body);

  return bytes;
}
