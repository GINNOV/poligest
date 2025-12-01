// Load environment variables for Prisma CLI commands (prefer .env.local)
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const env = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

const config = {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.js",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
};

export default config;
