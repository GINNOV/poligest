import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

type PrismaClientWithLogs = PrismaClient<
  Prisma.PrismaClientOptions,
  "query" | "info" | "warn" | "error"
>;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientWithLogs };
const isDev = process.env.NODE_ENV !== "production";

const devLogLevels: Prisma.LogDefinition[] = [
  { level: "warn", emit: "event" },
  { level: "error", emit: "event" },
];

const prodLogLevels: Prisma.LogDefinition[] = [
  { level: "warn", emit: "stdout" },
  { level: "error", emit: "stdout" },
];

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

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient<
    Prisma.PrismaClientOptions,
    "query" | "info" | "warn" | "error"
  >({
    adapter,
    log: isDev ? devLogLevels : prodLogLevels,
    errorFormat: "pretty",
});

if (isDev) {
  globalForPrisma.prisma = prisma;
}
