import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as typeof globalThis & {
  shoppableVideoPrisma?: PrismaClient;
};

export function createPrismaClient(
  databaseUrl = process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/shoppable_video",
) {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
}

export function getPrismaClient() {
  globalForPrisma.shoppableVideoPrisma ??= createPrismaClient();

  return globalForPrisma.shoppableVideoPrisma;
}
