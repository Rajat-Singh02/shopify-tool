import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "packages/db/prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/shoppable_video",
  },
  migrations: {
    path: "packages/db/prisma/migrations",
  },
});
