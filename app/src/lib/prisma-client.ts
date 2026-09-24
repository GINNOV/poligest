import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, type PoolClient } from "pg";
import { rewriteDemoSql } from "@/lib/demo/sql";

type PrismaClientWithLogs = PrismaClient<
  Prisma.PrismaClientOptions,
  "query" | "info" | "warn" | "error"
>;

const globalForPrisma = globalThis as unknown as {
  livePrisma?: PrismaClientWithLogs;
  demoPrisma?: PrismaClientWithLogs;
  demoTables?: Set<string>;
};

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

export function normalizeConnectionString(rawConnectionString: string) {
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

export const connectionString = normalizeConnectionString(
  process.env.POSTGRES_PRISMA_URL ??
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.DATABASE_URL ??
    "",
);

const demoConnectionString = normalizeConnectionString(
  process.env.DATABASE_URL_UNPOOLED ?? connectionString,
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
    "❌ src/lib/prisma-client.ts: Database URL missing. Set POSTGRES_PRISMA_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL in your env.",
  );
}

const createMissingDatabaseProxy = () =>
  new Proxy(
    {},
    {
      get() {
        throw new Error(
          "❌ src/lib/prisma-client.ts: Database URL missing. Set POSTGRES_PRISMA_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL in your env.",
        );
      },
    },
  ) as PrismaClientWithLogs;

function createPool(rawConnectionString = connectionString) {
  const pool = new Pool({
    connectionString: rawConnectionString,
    ssl: shouldUseSsl(rawConnectionString),
    max: poolMaxConnections,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis,
  });
  pool.on("error", (err) => {
    console.error("❌ src/lib/prisma-client.ts: Unexpected error on idle client", err);
  });
  return pool;
}

function createClient(pool: Pool) {
  const adapter = new PrismaPg(pool);
  return new PrismaClient<Prisma.PrismaClientOptions, "query" | "info" | "warn" | "error">({
    adapter,
    log: isDev ? devLogLevels : prodLogLevels,
    errorFormat: "pretty",
  });
}

async function loadDemoTables(pool: Pool) {
  if (globalForPrisma.demoTables) return globalForPrisma.demoTables;
  const result = await pool.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
  );
  const tables = new Set(result.rows.map((row) => row.tablename));
  globalForPrisma.demoTables = tables;
  return tables;
}

type QueryConfig = string | { text: string; [key: string]: unknown };

function rewriteConfig(config: QueryConfig, tables: ReadonlySet<string>): QueryConfig {
  if (typeof config === "string") return rewriteDemoSql(config, tables);
  if (config && typeof config.text === "string") {
    return { ...config, text: rewriteDemoSql(config.text, tables) };
  }
  return config;
}

function wrapDemoClient(client: PoolClient, tables: ReadonlySet<string>) {
  const originalQuery = client.query.bind(client) as (...args: unknown[]) => unknown;
  client.query = ((first: QueryConfig, second?: unknown, third?: unknown) => {
    const rewritten = rewriteConfig(first, tables);
    if (typeof second === "function") return originalQuery(rewritten, second);
    if (typeof third === "function") return originalQuery(rewritten, second, third);
    return originalQuery(rewritten, second);
  }) as PoolClient["query"];
  return client;
}

function armDemoClient(client: PoolClient, tables: ReadonlySet<string>, done: (error?: Error) => void, callback: (error?: Error) => void) {
  client.query("SET ROLE demo_app", (error: Error) => {
    if (error) {
      done(error);
      callback(error);
      return;
    }
    wrapDemoClient(client, tables);
    callback();
  });
}

function createDemoPool(basePool: Pool) {
  const pool = createPool(demoConnectionString);
  const connect = pool.connect.bind(pool) as Pool["connect"];
  pool.connect = ((callback?: (error: Error | undefined, client: PoolClient | undefined, done: (release?: Error) => void) => void) => {
    const ready = loadDemoTables(basePool);
    if (typeof callback === "function") {
      ready
        .then((tables) => {
          connect((error, client, done) => {
            if (error || !client) {
              callback(error, client, done);
              return;
            }
            const release = done;
            armDemoClient(client, tables, release, (roleError) => {
              if (!roleError) {
                const originalRelease = client.release.bind(client);
                client.release = (err?: Error | boolean) => {
                  client.query("RESET ROLE", () => originalRelease(err));
                };
              }
              callback(roleError, roleError ? undefined : client, release);
            });
          });
        })
        .catch((error: Error) => callback(error, undefined, () => undefined));
      return undefined as unknown as PoolClient;
    }

    return ready.then(
      (tables) =>
        new Promise<PoolClient>((resolve, reject) => {
          connect((error, client, done) => {
            if (error || !client) {
              reject(error ?? new Error("Connessione demo non disponibile"));
              return;
            }
            armDemoClient(client, tables, done, (roleError) => {
              if (roleError || !client) {
                reject(roleError ?? new Error("Ruolo demo non disponibile"));
                return;
              }
              resolve(client);
            });
          });
        }),
    );
  }) as Pool["connect"];
  return pool;
}

const livePool = connectionString ? createPool() : null;

export const livePrisma: PrismaClientWithLogs =
  globalForPrisma.livePrisma ?? (livePool ? createClient(livePool) : createMissingDatabaseProxy());

export const demoPrisma: PrismaClientWithLogs =
  globalForPrisma.demoPrisma ??
  (livePool ? createClient(createDemoPool(livePool)) : createMissingDatabaseProxy());

if (isDev && connectionString) {
  globalForPrisma.livePrisma = livePrisma;
  globalForPrisma.demoPrisma = demoPrisma;
}

