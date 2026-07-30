import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => {
  const prisma = {
    patient: {
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  const logMacosScanAudit = vi.fn();
  const findExistingPatientForCreate = vi.fn();
  const mergeMissingPatientFieldsFromMacosScan = vi.fn();

  return {
    prisma,
    logMacosScanAudit,
    findExistingPatientForCreate,
    mergeMissingPatientFieldsFromMacosScan,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/audit", () => ({
  logMacosScanAudit: mocks.logMacosScanAudit,
}));

vi.mock("@/lib/patients/find-existing-patient", () => ({
  findExistingPatientForCreate: mocks.findExistingPatientForCreate,
}));

vi.mock("@/lib/patients/macos-patient-sync", async () => {
  const actual = await vi.importActual<typeof import("@/lib/patients/macos-patient-sync")>(
    "@/lib/patients/macos-patient-sync",
  );
  return {
    ...actual,
    mergeMissingPatientFieldsFromMacosScan: mocks.mergeMissingPatientFieldsFromMacosScan,
  };
});

describe("POST /api/patients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logMacosScanAudit.mockResolvedValue(undefined);
    mocks.prisma.patient.update.mockResolvedValue(undefined);
    mocks.findExistingPatientForCreate.mockResolvedValue(null);
    mocks.mergeMissingPatientFieldsFromMacosScan.mockResolvedValue({
      patientId: "existing-patient-id",
      updatedFields: [],
    });
    process.env.MACOS_APP_API_KEY = "test_secret_token";
  });

  it("returns 401 if unauthorized (missing token)", async () => {
    const req = new Request("http://localhost/api/patients", {
      method: "POST",
      body: JSON.stringify({ firstName: "Mario", lastName: "Rossi" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 401 if unauthorized (wrong token)", async () => {
    const req = new Request("http://localhost/api/patients", {
      method: "POST",
      headers: {
        "x-api-key": "wrong_token",
      },
      body: JSON.stringify({ firstName: "Mario", lastName: "Rossi" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 if firstName is missing", async () => {
    const req = new Request("http://localhost/api/patients", {
      method: "POST",
      headers: {
        "x-api-key": "test_secret_token",
      },
      body: JSON.stringify({ lastName: "Rossi" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("First name and last name are required");
  });

  it("creates patient successfully with valid token and fields", async () => {
    mocks.prisma.patient.create.mockResolvedValue({ id: "new-patient-id" });

    const req = new Request("http://localhost/api/patients", {
      method: "POST",
      headers: {
        Authorization: "Bearer test_secret_token",
      },
      body: JSON.stringify({
        firstName: "Mario",
        lastName: "Rossi",
        birthDate: "05/03/1971",
        gender: "M",
        notes: "Some notes",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.action).toBe("created");
    expect(json.patientId).toBe("new-patient-id");

    expect(mocks.prisma.patient.create).toHaveBeenCalledWith({
      data: {
        firstName: "Mario",
        lastName: "Rossi",
        email: null,
        phone: null,
        birthDate: expect.any(Date),
        gender: "MALE",
        taxId: null,
        notes: "Some notes\nATTENZIONE: Firma acquisita su supporto cartaceo per i moduli obbligatori.",
        hasPaperConsentForRequired: true,
      },
    });
    expect(mocks.prisma.patient.update).toHaveBeenCalledWith({
      where: { id: "new-patient-id" },
      data: {
        photoUrl: expect.stringMatching(/^\/avatars\//),
      },
    });
    expect(mocks.logMacosScanAudit).toHaveBeenCalledWith({
      action: "patient.created",
      patientId: "new-patient-id",
      metadata: {
        patientName: "Rossi Mario",
      },
    });
  });

  it("can disable paper consent when explicitly requested", async () => {
    mocks.prisma.patient.create.mockResolvedValue({ id: "new-patient-id" });

    const req = new Request("http://localhost/api/patients", {
      method: "POST",
      headers: {
        "x-api-key": "test_secret_token",
      },
      body: JSON.stringify({
        firstName: "Mario",
        lastName: "Rossi",
        notes: "Some notes",
        hasPaperConsentForRequired: false,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mocks.prisma.patient.create).toHaveBeenCalledWith({
      data: {
        firstName: "Mario",
        lastName: "Rossi",
        email: null,
        phone: null,
        birthDate: null,
        gender: "NOT_SPECIFIED",
        taxId: null,
        notes: "Some notes",
        hasPaperConsentForRequired: false,
      },
    });
    expect(mocks.prisma.patient.update).toHaveBeenCalledWith({
      where: { id: "new-patient-id" },
      data: {
        photoUrl: expect.stringMatching(/^\/avatars\//),
      },
    });
  });

  it("merges into existing patient instead of creating a duplicate (ScanID-safe)", async () => {
    mocks.findExistingPatientForCreate.mockResolvedValue({
      patientId: "existing-patient-id",
      matchKind: "taxId",
      firstName: "Mario",
      lastName: "Rossi",
      phone: null,
    });
    mocks.mergeMissingPatientFieldsFromMacosScan.mockResolvedValue({
      patientId: "existing-patient-id",
      updatedFields: ["birthDate", "codiceFiscale"],
    });

    const req = new Request("http://localhost/api/patients", {
      method: "POST",
      headers: {
        "x-api-key": "test_secret_token",
      },
      body: JSON.stringify({
        firstName: "Mario",
        lastName: "Rossi",
        birthDate: "15/08/1990",
        gender: "M",
        notes: "Codice Fiscale: RSSMRA90A15H501Y\nAcquisito automaticamente da ID Scanner macOS",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    // ScanID only requires patientId on success; action may be "updated".
    expect(json.ok).toBe(true);
    expect(json.patientId).toBe("existing-patient-id");
    expect(json.action).toBe("updated");
    expect(json.matchKind).toBe("taxId");
    expect(mocks.prisma.patient.create).not.toHaveBeenCalled();
    expect(mocks.mergeMissingPatientFieldsFromMacosScan).toHaveBeenCalledWith(
      "existing-patient-id",
      expect.objectContaining({
        codiceFiscale: "RSSMRA90A15H501Y",
        birthDate: "15/08/1990",
      }),
    );
    expect(mocks.logMacosScanAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "patient.updated",
        patientId: "existing-patient-id",
      }),
    );
  });
});
