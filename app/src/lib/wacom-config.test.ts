import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    wacomConfig: {
      findUnique: findUniqueMock,
    },
  },
}));

import { clearWacomConfigCache, getWacomLicenseConfig, maskWacomValue } from "./wacom-config";

describe("wacom-config", () => {
  beforeEach(() => {
    clearWacomConfigCache();
    findUniqueMock.mockReset();
    delete process.env.WACOM_SIGNATURE_KEY;
    delete process.env.WACOM_SIGNATURE_SECRET;
    delete process.env.NEXT_PUBLIC_WACOM_SIGNATURE_KEY;
    delete process.env.NEXT_PUBLIC_WACOM_SIGNATURE_SECRET;
  });

  afterEach(() => {
    clearWacomConfigCache();
  });

  it("masks license values for display", () => {
    expect(maskWacomValue("958347de-7df6-4f5f-b185-ea5da5efa9ae")).toMatch(/^958347de\*+ae$/);
  });

  it("prefers database config over env fallback", async () => {
    process.env.WACOM_SIGNATURE_KEY = "env-key";
    process.env.WACOM_SIGNATURE_SECRET = "env-secret";
    findUniqueMock.mockResolvedValue({
      id: "default",
      licenseKey: "db-key",
      licenseSecret: "db-secret",
    });

    const config = await getWacomLicenseConfig();

    expect(config).toEqual({
      licenseKey: "db-key",
      licenseSecret: "db-secret",
      source: "db",
    });
  });

  it("falls back to env when database config is missing", async () => {
    process.env.WACOM_SIGNATURE_KEY = "env-key";
    process.env.WACOM_SIGNATURE_SECRET = "env-secret";
    findUniqueMock.mockResolvedValue(null);

    const config = await getWacomLicenseConfig();

    expect(config).toEqual({
      licenseKey: "env-key",
      licenseSecret: "env-secret",
      source: "env",
    });
  });
});