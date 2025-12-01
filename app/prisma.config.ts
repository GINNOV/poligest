// Load environment variables for Prisma CLI commands (prefer .env.local)
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const getDbUrl = () =>
  process.env.POSTGRES_PRISMA_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL;

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
    url: dbUrl,
  },
};

export default config;
