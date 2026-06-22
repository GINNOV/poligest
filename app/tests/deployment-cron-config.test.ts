import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateCronSecret } from "@/lib/cron-auth";
import { REQUIRED_VERCEL_ENV_VARS } from "./vercel-env-contract";

const appRoot = resolve(__dirname, "..");

const EXPECTED_CRONS = [
  { path: "/api/recalls/send", schedule: "0 7 * * *" },
  { path: "/api/notifications/recurring", schedule: "0 8 * * *" },
  { path: "/api/reports/weekly", schedule: "0 12 * * 6" },
] as const;

const CRON_ROUTE_FILES: Record<(typeof EXPECTED_CRONS)[number]["path"], string> = {
  "/api/recalls/send": "src/app/api/recalls/send/route.ts",
  "/api/notifications/recurring": "src/app/api/notifications/recurring/route.ts",
  "/api/reports/weekly": "src/app/api/reports/weekly/route.ts",
};

const CRON_FIELD_PATTERN = /^(\*|[0-9]+(-[0-9]+)?(,[0-9]+(-[0-9]+)?)*)$/;

function parseCronSchedule(schedule: string) {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  return { minute, hour, dayOfMonth, month, dayOfWeek };
}

function isValidCronSchedule(schedule: string): boolean {
  const parsed = parseCronSchedule(schedule);
  if (!parsed) return false;

  return Object.values(parsed).every((field) => CRON_FIELD_PATTERN.test(field));
}

describe("deployment and cron configuration", () => {
  it("documents CRON_SECRET as a required Vercel environment variable", () => {
    const cronSecretContract = REQUIRED_VERCEL_ENV_VARS.find((entry) => entry.name === "CRON_SECRET");

    expect(cronSecretContract).toBeDefined();
    expect(cronSecretContract?.usedBy).toContain("vercel.json crons");
    expect(cronSecretContract?.usedBy).toContain("src/lib/cron-auth.ts");
    expect(cronSecretContract?.reason).toMatch(/unset|reject/i);
  });

  it("defines vercel.json with all expected cron paths and valid schedules", () => {
    const vercelJsonPath = resolve(appRoot, "vercel.json");
    expect(existsSync(vercelJsonPath)).toBe(true);

    const vercelConfig = JSON.parse(readFileSync(vercelJsonPath, "utf8")) as {
      crons?: Array<{ path: string; schedule: string }>;
    };

    expect(vercelConfig.crons).toBeDefined();

    for (const expected of EXPECTED_CRONS) {
      const cron = vercelConfig.crons?.find((entry) => entry.path === expected.path);
      expect(cron, `missing cron for ${expected.path}`).toBeDefined();
      expect(cron?.schedule).toBe(expected.schedule);
      expect(isValidCronSchedule(cron?.schedule ?? "")).toBe(true);
    }

    expect(vercelConfig.crons).toHaveLength(EXPECTED_CRONS.length);
  });

  it("keeps the weekly report cron on Saturday afternoon, matching the admin UI promise", () => {
    const vercelConfig = JSON.parse(readFileSync(resolve(appRoot, "vercel.json"), "utf8")) as {
      crons?: Array<{ path: string; schedule: string }>;
    };
    const weeklyCron = vercelConfig.crons?.find((entry) => entry.path === "/api/reports/weekly");
    const adminPage = readFileSync(
      resolve(appRoot, "src/app/[locale]/(app)/admin/report-settimanale/page.tsx"),
      "utf8",
    );

    expect(weeklyCron?.schedule).toBe("0 12 * * 6");

    const parsed = parseCronSchedule(weeklyCron?.schedule ?? "");
    expect(parsed?.dayOfWeek).toBe("6");
    expect(parsed?.dayOfWeek).not.toBe("1");

    expect(adminPage).toMatch(/Sabato pomeriggio alle 14:00/i);
    expect(adminPage).toMatch(/Sabato ore 14:00/i);

    // Saturday 12:00 UTC = 14:00 Europe/Rome during daylight saving time.
    const summerRomeHour = new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Europe/Rome",
    }).format(new Date("2026-06-20T12:00:00.000Z"));

    expect(summerRomeHour).toBe("14");
  });

  it("requires cron API routes to import validateCronSecret from @/lib/cron-auth", () => {
    for (const [path, relativeRouteFile] of Object.entries(CRON_ROUTE_FILES)) {
      const routeFile = resolve(appRoot, relativeRouteFile);
      expect(existsSync(routeFile), `missing route file for ${path}`).toBe(true);

      const source = readFileSync(routeFile, "utf8");
      expect(source).toMatch(/import\s*\{[^}]*validateCronSecret[^}]*\}\s*from\s*["']@\/lib\/cron-auth["']/);
      expect(source).toMatch(/validateCronSecret\s*\(/);
    }
  });

  it("rejects cron requests when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");

    await expect(
      validateCronSecret(
        new Request("https://example.test/api/reports/weekly", {
          headers: { authorization: "Bearer secret" },
        }),
      ),
    ).resolves.toBe(false);

    vi.unstubAllEnvs();
  });
});