import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const { requireUserMock, getWacomLicenseConfigMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  getWacomLicenseConfigMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/wacom-config", () => ({
  getWacomLicenseConfig: getWacomLicenseConfigMock,
}));

vi.mock("@/lib/error-reporting", () => ({
  reportError: vi.fn(async () => "ERR-TEST"),
}));

import { GET } from "./route";

describe("GET /api/wacom/license", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
    getWacomLicenseConfigMock.mockReset();
    requireUserMock.mockResolvedValue({ id: "user-1", role: Role.ADMIN });
  });

  it("returns configured license for authenticated users", async () => {
    getWacomLicenseConfigMock.mockResolvedValue({
      licenseKey: "key-1",
      licenseSecret: "secret-1",
      source: "db",
    });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      configured: true,
      licenseKey: "key-1",
      licenseSecret: "secret-1",
      source: "db",
    });
  });

  it("returns configured false when license is missing", async () => {
    getWacomLicenseConfigMock.mockResolvedValue(null);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ configured: false });
  });
});