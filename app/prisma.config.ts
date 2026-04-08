// Load environment variables for Prisma CLI commands (prefer .env.local)
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const getDbUrl = () =>
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.DATABASE_URL;

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

const dbUrl = getDbUrl();

if (!dbUrl) {
  throw new Error(
    "Missing database URL. Set POSTGRES_PRISMA_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL in your env."
  );
}

const config = {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.js",
  },
  datasource: {
    url: normalizeConnectionString(dbUrl),
  },
};

export default config;
