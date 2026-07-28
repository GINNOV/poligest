import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

type PrismaClientWithLogs = PrismaClient<
  Prisma.PrismaClientOptions,
  "query" | "info" | "warn" | "error"
>;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientWithLogs };
const isDev = process.env.NODE_ENV !== "production";
const poolMaxConnections = isDev ? 10 : 1;
const connectionTimeoutMillis = isDev ? 10000 : 30000;

const devLogLevels: Prisma.LogDefinition[] = [
  { level: "warn", emit: "event" },
  { level: "error", emit: "event" },
];

const prodLogLevels: Prisma.LogDefinition[] = [
  { level: "warn", emit: "stdout" },
  { level: "error", emit: "stdout" },
];

function normalizeConnectionString(rawConnectionString: string) {
  try {
    const parsed = new URL(rawConnectionString);
    if (parsed.searchParams.get("sslmode") === "require" && !parsed.searchParams.has("uselibpqcompat")) {
      parsed.searchParams.set("uselibpqcompat", "true");
    }
    return parsed.toString();
  } catch {
    return rawConnectionString;
  }
}

const connectionString = normalizeConnectionString(
  process.env.POSTGRES_PRISMA_URL ??
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.DATABASE_URL ??
    ""
);

function shouldUseSsl(rawConnectionString: string) {
  try {
    const parsed = new URL(rawConnectionString);
    return parsed.searchParams.get("sslmode") !== "disable";
  } catch {
    return true;
  }
}

export const isPrismaConfigured = Boolean(connectionString);

if (!connectionString && !isDev) {
  throw new Error(
    "❌ src/lib/prisma.ts: Database URL missing. Set POSTGRES_PRISMA_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL in your env."
  );
}

const createMissingDatabaseProxy = () =>
  new Proxy(
    {},
    {
      get() {
        throw new Error(
          "❌ src/lib/prisma.ts: Database URL missing. Set POSTGRES_PRISMA_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL in your env.",
        );
      },
    },
  ) as PrismaClientWithLogs;

const createPrismaClient = () => {
  if (!connectionString) {
    return createMissingDatabaseProxy();
  }

  const pool = new Pool({
    connectionString,
    ssl: shouldUseSsl(connectionString),
    max: poolMaxConnections,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis,
  });

  // Test the pool connection immediately to fail fast if there's an issue
  pool.on("error", (err) => {
    console.error("❌ src/lib/prisma.ts: Unexpected error on idle client", err);
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient<
    Prisma.PrismaClientOptions,
    "query" | "info" | "warn" | "error"
  >({
    adapter,
    log: isDev ? devLogLevels : prodLogLevels,
    errorFormat: "pretty",
  });
};

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (isDev && connectionString) {
  globalForPrisma.prisma = prisma;
}
