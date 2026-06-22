import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/wacom-config", () => ({
  getWacomLicenseConfig: vi.fn(async () => ({
    licenseKey: "test-key",
    licenseSecret: "test-secret",
    source: "db",
  })),
  maskWacomValue: (value: string) => value,
}));

import { getWacomMeta } from "./wacom-meta";

describe("getWacomMeta", () => {
  it("reports license and sdk status", async () => {
    const meta = await getWacomMeta();

    expect(meta).toEqual(
      expect.objectContaining({
        licenseConfigured: true,
        licenseSource: "db",
        sdkFilesPresent: expect.any(Boolean),
        sdkFiles: expect.any(Array),
      }),
    );
  });
});