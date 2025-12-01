import { StackServerApp } from "@stackframe/stack";

function requireEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var ${key} for Stack Auth`);
  }
  return value;
}

export const stackServerApp = new StackServerApp({
  projectId: requireEnv("NEXT_PUBLIC_STACK_PROJECT_ID"),
  publishableClientKey: requireEnv("NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY"),
  secretServerKey: requireEnv("STACK_SECRET_SERVER_KEY"),
  tokenStore: "cookie",
  urls: {
    handler: "/handler",
  },
});
