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

const parseEnvDate = (value?: string) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const asNumber = Number(trimmed);
    if (!Number.isNaN(asNumber)) {
      const millis = trimmed.length <= 10 ? asNumber * 1000 : asNumber;
      const date = new Date(millis);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function getDeployDate() {
  return (
    parseEnvDate(process.env.NEXT_PUBLIC_DEPLOYED_AT) ||
    parseEnvDate(process.env.DEPLOYED_AT) ||
    parseEnvDate(process.env.VERCEL_DEPLOYMENT_CREATED_AT) ||
    parseEnvDate(process.env.VERCEL_GIT_COMMIT_DATE) ||
    null
  );
}
