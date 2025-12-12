import { StackServerApp } from "@stackframe/stack";

function requireEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var ${key} for Stack Auth`);
  }
  return value;
}

const rawStackApiUrl = process.env.NEXT_PUBLIC_STACK_API_URL || process.env.STACK_API_URL;
const STACK_API_BASE = (rawStackApiUrl && /^https?:\/\//.test(rawStackApiUrl)
  ? rawStackApiUrl
  : "https://api.stack-auth.com"
).replace(/\/$/, "");

export const stackServerApp = new StackServerApp({
  projectId: requireEnv("NEXT_PUBLIC_STACK_PROJECT_ID"),
  publishableClientKey: requireEnv("NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY"),
  secretServerKey: requireEnv("STACK_SECRET_SERVER_KEY"),
  tokenStore: "nextjs-cookie",
  baseUrl: {
    // Force browser requests through our Next.js proxy to keep keys server-side.
    browser: "/api/stack",
    server: STACK_API_BASE,
  },
  urls: {
    handler: "/handler",
  },
});
