import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mergeMissingPatientFieldsFromMacosScan: vi.fn(),
  logMacosScanAudit: vi.fn(),
}));

vi.mock("@/lib/patients/macos-patient-sync", () => ({
  mergeMissingPatientFieldsFromMacosScan: mocks.mergeMissingPatientFieldsFromMacosScan,
}));

vi.mock("@/lib/audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/audit")>();
  return {
    ...actual,
    logMacosScanAudit: mocks.logMacosScanAudit,
  };
});

import { PATCH } from "./route";

describe("PATCH /api/patients/[patientId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logMacosScanAudit.mockResolvedValue(undefined);
    process.env.MACOS_APP_API_KEY = "test_secret_token";
    mocks.mergeMissingPatientFieldsFromMacosScan.mockResolvedValue({
      patientId: "patient-1",
      updatedFields: ["birthDate"],
    });
  });

  it("returns 401 when unauthorized", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/patients/patient-1", {
        method: "PATCH",
        body: JSON.stringify({ birthDate: "15/08/1990" }),
      }),
      { params: Promise.resolve({ patientId: "patient-1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("merges missing fields for an existing patient", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/patients/patient-1", {
        method: "PATCH",
        headers: { "x-api-key": "test_secret_token" },
        body: JSON.stringify({
          birthDate: "15/08/1990",
          gender: "M",
          codiceFiscale: "RSSMRA90A15H501Y",
        }),
      }),
      { params: Promise.resolve({ patientId: "patient-1" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      action: "updated",
      patientId: "patient-1",
      updatedFields: ["birthDate"],
    });
    expect(mocks.mergeMissingPatientFieldsFromMacosScan).toHaveBeenCalledWith("patient-1", {
      birthDate: "15/08/1990",
      gender: "M",
      codiceFiscale: "RSSMRA90A15H501Y",
    });
    expect(mocks.logMacosScanAudit).toHaveBeenCalledWith({
      action: "patient.updated",
      patientId: "patient-1",
      metadata: {
        updatedFields: ["birthDate"],
      },
    });
  });
});