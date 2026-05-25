CREATE TABLE "VideoStorageObject" (
  "key" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "body" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VideoStorageObject_pkey" PRIMARY KEY ("key")
);
