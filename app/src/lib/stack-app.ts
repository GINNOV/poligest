import { StackServerApp } from "@stackframe/stack";

const REQUIRED_STACK_ENV_KEYS = [
  "NEXT_PUBLIC_STACK_PROJECT_ID",
  "NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY",
  "STACK_SECRET_SERVER_KEY",
] as const;

function requireEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var ${key} for Stack Auth`);
  }
  return value;
}

export function getMissingStackEnvKeys() {
  return REQUIRED_STACK_ENV_KEYS.filter((key) => !process.env[key]);
}

export function isStackAuthConfigured() {
  return getMissingStackEnvKeys().length === 0;
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

export function getStackServerApp(explicitOrigin?: string) {
  const siteOrigin = normalizeSiteOrigin(explicitOrigin) || resolveDefaultSiteOrigin();
  const browserBaseUrl = process.env.NEXT_PUBLIC_STACK_BROWSER_URL
    ? normalizeSiteOrigin(process.env.NEXT_PUBLIC_STACK_BROWSER_URL)
    : siteOrigin
      ? `${siteOrigin}/api/stack`
      : STACK_API_BASE;
  return new StackServerApp({
    projectId: requireEnv("NEXT_PUBLIC_STACK_PROJECT_ID"),
    publishableClientKey: requireEnv("NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY"),
    secretServerKey: requireEnv("STACK_SECRET_SERVER_KEY"),
    tokenStore: "nextjs-cookie",
    noAutomaticPrefetch: true,
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

export function getOptionalStackServerApp(explicitOrigin?: string) {
  if (!isStackAuthConfigured()) {
    if (process.env.NODE_ENV === "production") {
      requireEnv(getMissingStackEnvKeys()[0]);
    }
    return null;
  }

  return getStackServerApp(explicitOrigin);
}

export function getStackSignInUrl() {
  return isStackAuthConfigured() ? getStackServerApp().urls.signIn : "/auth/login?config=missing-stack";
}

export function getStackSignOutUrl() {
  return isStackAuthConfigured() ? (getStackServerApp().urls.signOut ?? "/handler/sign-out") : "/auth/login";
}

export const stackServerApp = isStackAuthConfigured() ? getStackServerApp() : null;
