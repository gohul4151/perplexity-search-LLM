import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * The shared Prisma client.
 *
 * Next.js reloads server modules on every edit in development, so creating a
 * client at module scope would open a new pool of Postgres connections on each
 * reload until Supabase refuses them. Caching the client on `globalThis`
 * survives the reload, so we keep exactly one pool.
 */

function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Only cache in development — production starts a fresh process anyway.
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
