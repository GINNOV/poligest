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

function normalizeSiteOrigin(rawOrigin: string | undefined) {
  if (!rawOrigin) {
    return "";
  }
  if (/^https?:\/\//.test(rawOrigin)) {
    return rawOrigin.replace(/\/$/, "");
  }
  return `https://${rawOrigin.replace(/\/$/, "")}`;
}

function resolveDefaultSiteOrigin() {
  if (process.env.NODE_ENV === "production") {
    return normalizeSiteOrigin(
      process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.VERCEL_URL,
    );
  }
  return normalizeSiteOrigin(process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL);
}

function buildBrowserBaseUrl(siteOrigin: string) {
  return siteOrigin ? `${siteOrigin}/api/stack` : "/api/stack";
}

export function getStackServerApp(explicitOrigin?: string) {
  const siteOrigin = normalizeSiteOrigin(explicitOrigin) || resolveDefaultSiteOrigin();
  const browserBaseUrl = process.env.NEXT_PUBLIC_STACK_BROWSER_URL
    ? normalizeSiteOrigin(process.env.NEXT_PUBLIC_STACK_BROWSER_URL)
    : STACK_API_BASE;
  return new StackServerApp({
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
}

export const stackServerApp = getStackServerApp();
