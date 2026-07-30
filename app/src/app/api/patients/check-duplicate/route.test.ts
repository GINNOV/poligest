import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const requireUser = vi.fn();
  const findExistingPatientForCreate = vi.fn();

  return {
    requireUser,
    findExistingPatientForCreate,
  };
});

vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/patients/find-existing-patient", () => ({
  findExistingPatientForCreate: mocks.findExistingPatientForCreate,
}));

import { GET } from "@/app/api/patients/check-duplicate/route";

describe("GET /api/patients/check-duplicate", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireUser.mockResolvedValue({ id: "staff-1", role: "ADMIN" });
    mocks.findExistingPatientForCreate.mockResolvedValue(null);
  });

  it("checks duplicate patients by normalized phone when birth date is missing", async () => {
    mocks.findExistingPatientForCreate.mockResolvedValue({
      patientId: "patient-1",
      matchKind: "phone",
      firstName: "Mario",
      lastName: "Rossi",
      phone: "+393331234567",
    });

    const response = await GET(
      new Request("http://localhost/api/patients/check-duplicate?firstName=mario&lastName=rossi&phone=3331234567"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      exists: true,
      matchKind: "phone",
      patient: {
        id: "patient-1",
        firstName: "Mario",
        lastName: "Rossi",
        phone: "+393331234567",
        birthDate: null,
      },
    });
    expect(mocks.findExistingPatientForCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "mario",
        lastName: "rossi",
        phone: "3331234567",
      }),
    );
  });

  it("checks duplicate patients by tax id", async () => {
    mocks.findExistingPatientForCreate.mockResolvedValue({
      patientId: "patient-cf",
      matchKind: "taxId",
      firstName: "Mario",
      lastName: "Rossi",
      phone: null,
    });

    const response = await GET(
      new Request(
        "http://localhost/api/patients/check-duplicate?firstName=Mario&lastName=Rossi&taxId=RSSMRA90A15H501Y",
      ),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.exists).toBe(true);
    expect(json.matchKind).toBe("taxId");
    expect(mocks.findExistingPatientForCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        taxId: "RSSMRA90A15H501Y",
      }),
    );
  });
});
