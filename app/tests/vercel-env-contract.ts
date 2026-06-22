/**
 * Deployment contract: environment variables that must be configured on Vercel.
 * These tests document required production settings; they do not call the Vercel API.
 */
export const REQUIRED_VERCEL_ENV_VARS = [
  {
    name: "CRON_SECRET",
    reason:
      "Vercel Cron sends Authorization: Bearer <secret>. Cron API routes reject all requests when this is unset.",
    usedBy: ["vercel.json crons", "src/lib/cron-auth.ts"],
  },
] as const;

export type RequiredVercelEnvVar = (typeof REQUIRED_VERCEL_ENV_VARS)[number];