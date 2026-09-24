/* eslint-disable @typescript-eslint/no-require-imports */
const { Pool } = require("pg");

function normalizeConnectionString(rawConnectionString) {
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
  process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL ||
    "",
);

if (!connectionString) {
  console.error("sync-demo-schema: database URL missing");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
});

pool
  .query("SELECT sync_demo_schema()")
  .then(() => {
    console.log("demo schema synced");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
