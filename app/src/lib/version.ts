import { execSync } from "node:child_process";

export function getAppVersion() {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    process.env.GIT_COMMIT_SHA?.slice(0, 7) ||
    process.env.NEXT_PUBLIC_APP_VERSION ||
    (() => {
      try {
        return execSync("git rev-parse --short HEAD").toString().trim();
      } catch {
        return "unknown";
      }
    })()
  );
}
