import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  patient: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    patient: mocks.patient,
  },
}));

import {
  findExistingPatientForCreate,
  formatExistingPatientBlockMessage,
  sameCalendarDate,
} from "@/lib/patients/find-existing-patient";

describe("sameCalendarDate", () => {
  it("matches UTC-stored and local-midnight civil days", () => {
    const utc = new Date("1990-08-15T00:00:00.000Z");
    const local = new Date(1990, 7, 15);
    expect(sameCalendarDate(utc, local) || sameCalendarDate(utc, utc)).toBe(true);
    expect(sameCalendarDate(utc, utc)).toBe(true);
  });
});

describe("findExistingPatientForCreate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.patient.findMany.mockResolvedValue([]);
  });

  it("matches by codice fiscale in notes without requiring name", async () => {
    mocks.patient.findMany.mockResolvedValueOnce([
      {
        id: "patient-cf",
        firstName: "Mario",
        lastName: "Rossi",
        phone: "+393331234567",
        notes: "Codice Fiscale: RSSMRA90A15H501Y\nAltro",
      },
    ]);

    const match = await findExistingPatientForCreate({
      firstName: "",
      lastName: "",
      taxId: "rssmra90a15h501y",
    });

    expect(match).toEqual({
      patientId: "patient-cf",
      matchKind: "taxId",
      firstName: "Mario",
      lastName: "Rossi",
      phone: "+393331234567",
    });
  });

  it("matches same name + normalized phone", async () => {
    mocks.patient.findMany
      .mockResolvedValueOnce([]) // tax id path skipped when no taxId
      .mockResolvedValueOnce([
        {
          id: "patient-phone",
          firstName: "Mario",
          lastName: "Rossi",
          email: null,
          phone: "3331234567",
          birthDate: null,
        },
      ]);

    // no taxId → only name query
    mocks.patient.findMany.mockReset();
    mocks.patient.findMany.mockResolvedValue([
      {
        id: "patient-phone",
        firstName: "Mario",
        lastName: "Rossi",
        email: null,
        phone: "3331234567",
        birthDate: null,
      },
    ]);

    const match = await findExistingPatientForCreate({
      firstName: "mario",
      lastName: "rossi",
      phone: "333 123 4567",
    });

    expect(match?.patientId).toBe("patient-phone");
    expect(match?.matchKind).toBe("phone");
  });

  it("matches same name + birth date across UTC/local storage", async () => {
    mocks.patient.findMany.mockResolvedValue([
      {
        id: "patient-dob",
        firstName: "Mario",
        lastName: "Rossi",
        email: null,
        phone: null,
        birthDate: new Date("1990-08-15T00:00:00.000Z"),
      },
    ]);

    const match = await findExistingPatientForCreate({
      firstName: "Mario",
      lastName: "Rossi",
      birthDate: new Date(1990, 7, 15),
    });

    expect(match).toEqual(
      expect.objectContaining({
        patientId: "patient-dob",
        matchKind: "nameBirthDate",
      }),
    );
  });

  it("does not match name alone without a strong signal", async () => {
    const match = await findExistingPatientForCreate({
      firstName: "Mario",
      lastName: "Rossi",
    });

    expect(match).toBeNull();
    expect(mocks.patient.findMany).not.toHaveBeenCalled();
  });

  it("prefers taxId over weaker signals", async () => {
    mocks.patient.findMany.mockResolvedValueOnce([
      {
        id: "patient-cf",
        firstName: "Other",
        lastName: "Person",
        phone: null,
        notes: "Codice Fiscale: RSSMRA90A15H501Y",
      },
    ]);

    const match = await findExistingPatientForCreate({
      firstName: "Mario",
      lastName: "Rossi",
      phone: "3331234567",
      taxId: "RSSMRA90A15H501Y",
    });

    expect(match?.matchKind).toBe("taxId");
    expect(match?.patientId).toBe("patient-cf");
    expect(mocks.patient.findMany).toHaveBeenCalledTimes(1);
  });
});

describe("formatExistingPatientBlockMessage", () => {
  it("mentions match kind and patient name", () => {
    const message = formatExistingPatientBlockMessage({
      patientId: "p1",
      matchKind: "phone",
      firstName: "Mario",
      lastName: "Rossi",
    });
    expect(message).toContain("telefono");
    expect(message).toContain("Rossi Mario");
  });
});
