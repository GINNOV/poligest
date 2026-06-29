import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_BRAND_NAME } from "@/lib/brand";

const appRoot = resolve(__dirname, "..");

const OUTBOUND_COMMS_FILES = [
  "src/lib/email.ts",
  "src/lib/email-template-utils.ts",
  "src/lib/daily-reminder.ts",
  "src/lib/practice-weekly-report.ts",
  "src/lib/whatsapp-template.ts",
  "src/lib/recurring-messages/domain.ts",
  "src/lib/welcome-email.ts",
] as const;

const LEGACY_BRAND_PATTERNS = [/poligest/i];

describe("brand regression", () => {
  it("exports the SORRISO app brand name", () => {
    expect(APP_BRAND_NAME).toBe("SORRISO");
  });

  it.each(OUTBOUND_COMMS_FILES)("keeps legacy Poligest branding out of %s", (relativePath) => {
    const source = readFileSync(resolve(appRoot, relativePath), "utf8");

    for (const pattern of LEGACY_BRAND_PATTERNS) {
      expect(source).not.toMatch(pattern);
    }
  });
});