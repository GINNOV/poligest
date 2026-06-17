import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findPatientForMacosScan: vi.fn(),
}));

vi.mock("@/lib/patients/macos-patient-sync", () => ({
  findPatientForMacosScan: mocks.findPatientForMacosScan,
}));

import { POST } from "./route";

describe("POST /api/patients/lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MACOS_APP_API_KEY = "test_secret_token";
    mocks.findPatientForMacosScan.mockResolvedValue(null);
  });

  it("returns 401 when unauthorized", async () => {
    const response = await POST(
      new Request("http://localhost/api/patients/lookup", {
        method: "POST",
        body: JSON.stringify({ firstName: "Mario", lastName: "Rossi" }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("returns exists false when no patient matches", async () => {
    const response = await POST(
      new Request("http://localhost/api/patients/lookup", {
        method: "POST",
        headers: { "x-api-key": "test_secret_token" },
        body: JSON.stringify({ firstName: "Mario", lastName: "Rossi" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ exists: false });
  });

  it("returns the matched patient id", async () => {
    mocks.findPatientForMacosScan.mockResolvedValue({
      patientId: "patient-1",
      matchKind: "taxId",
    });

    const response = await POST(
      new Request("http://localhost/api/patients/lookup", {
        method: "POST",
        headers: { "x-api-key": "test_secret_token" },
        body: JSON.stringify({
          firstName: "Mario",
          lastName: "Rossi",
          codiceFiscale: "RSSMRA90A15H501Y",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      exists: true,
      patientId: "patient-1",
      matchKind: "taxId",
    });
  });
});