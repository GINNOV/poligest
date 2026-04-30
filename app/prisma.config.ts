import { defineConfig } from "@prisma/config";
import * as dotenv from "dotenv";
import "dotenv/config";

// Load .env.local if present
dotenv.config({ path: ".env.local" });

const getDbUrl = () =>
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL;

function normalizeConnectionString(rawConnectionString: string): string {
  try {
    const parsed = new URL(rawConnectionString);
    if (parsed.searchParams.get("sslmode") === "require" && !parsed.searchParams.has("uselibpqcompat")) {
      parsed.searchParams.set("uselibpqcompat", "true");
    }
    return parsed.toString();
  } catch (error) {
    return rawConnectionString;
  }
}

const dbUrl = getDbUrl();

if (!dbUrl) {
  // We need a string for the type checker, even if it's empty.
  // Prisma will fail anyway if the URL is missing during commands that need it.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.js",
  },
  datasource: {
    url: normalizeConnectionString(dbUrl || ""),
  },
});
