import { StackServerApp } from "@stackframe/stack";

function requireEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var ${key} for Stack Auth`);
  }
  return value;
}

const rawStackApiUrl = process.env.NEXT_PUBLIC_STACK_API_URL || process.env.STACK_API_URL;
const STACK_API_BASE = (
  rawStackApiUrl && /^https?:\/\//.test(rawStackApiUrl)
    ? rawStackApiUrl
    : "https://api.stack-auth.com"
).replace(/\/$/, "");

// Stack's client-side OAuth helpers require an absolute base URL. Use the site origin if provided.
const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "";
const browserBaseUrl = siteOrigin
  ? `${siteOrigin.replace(/\/$/, "")}/api/stack`
  : "/api/stack";

export const stackServerApp = new StackServerApp({
  projectId: requireEnv("NEXT_PUBLIC_STACK_PROJECT_ID"),
  publishableClientKey: requireEnv("NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY"),
  secretServerKey: requireEnv("STACK_SECRET_SERVER_KEY"),
  tokenStore: "nextjs-cookie",
  baseUrl: {
    // Force browser requests through our Next.js proxy to keep keys server-side.
    // Must be absolute for OAuth helpers; fallback to relative in dev.
    browser: browserBaseUrl,
    server: STACK_API_BASE,
  },
  urls: {
    handler: "/handler",
  },
});
