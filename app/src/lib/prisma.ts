import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const connectionString =
  process.env.POSTGRES_PRISMA_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "❌ src/lib/prisma.ts: Database URL missing. Set POSTGRES_PRISMA_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL in your env."
  );
}

const pool = new Pool({
  connectionString,
  ssl: true,
  max: 10, // Connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Test the pool connection immediately to fail fast if there's an issue
pool.on("error", (err) => {
  console.error("❌ src/lib/prisma.ts: Unexpected error on idle client", err);
});

const adapter = new PrismaPg(pool);

if (globalForPrisma.prisma) {
  console.log("⚠️ src/lib/prisma.ts: Reusing existing PrismaClient from globalThis");
} else {
  console.log("🆕 src/lib/prisma.ts: Creating NEW PrismaClient instance");
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
