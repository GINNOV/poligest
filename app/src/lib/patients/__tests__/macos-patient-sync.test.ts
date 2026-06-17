import { Gender } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  patient: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    patient: mocks.patient,
  },
}));

import {
  buildMacosPatientMergeUpdate,
  findPatientForMacosScan,
  mergeMissingPatientFieldsFromMacosScan,
  parseItalianSlashBirthDate,
} from "@/lib/patients/macos-patient-sync";

describe("parseItalianSlashBirthDate", () => {
  it("parses DD/MM/YYYY dates", () => {
    const parsed = parseItalianSlashBirthDate("15/08/1990");
    expect(parsed?.getFullYear()).toBe(1990);
    expect(parsed?.getMonth()).toBe(7);
    expect(parsed?.getDate()).toBe(15);
  });
});

describe("findPatientForMacosScan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("matches by codice fiscale in notes first", async () => {
    mocks.patient.findFirst.mockResolvedValueOnce({ id: "patient-tax" });

    const match = await findPatientForMacosScan({
      firstName: "Mario",
      lastName: "Rossi",
      birthDate: "15/08/1990",
      codiceFiscale: "rssmra90a15h501y",
    });

    expect(match).toEqual({ patientId: "patient-tax", matchKind: "taxId" });
    expect(mocks.patient.findFirst).toHaveBeenCalledTimes(1);
  });

  it("falls back to name and birth date when tax id is missing", async () => {
    mocks.patient.findFirst.mockResolvedValueOnce({ id: "patient-name" });

    const match = await findPatientForMacosScan({
      firstName: "mario",
      lastName: "rossi",
      birthDate: "15/08/1990",
    });

    expect(match).toEqual({ patientId: "patient-name", matchKind: "nameBirthDate" });
  });
});

describe("buildMacosPatientMergeUpdate", () => {
  const existing = {
    id: "patient-1",
    firstName: "Mario",
    lastName: "Rossi",
    email: null,
    phone: null,
    birthDate: null,
    gender: Gender.NOT_SPECIFIED,
    notes: "Anamnesi esistente",
  };

  it("fills only missing fields", () => {
    const { data, updatedFields } = buildMacosPatientMergeUpdate(existing, {
      birthDate: "15/08/1990",
      gender: "M",
      codiceFiscale: "RSSMRA90A15H501Y",
    });

    expect(updatedFields).toEqual(["birthDate", "gender", "codiceFiscale"]);
    expect(data.birthDate).toBeInstanceOf(Date);
    expect(data.gender).toBe(Gender.MALE);
    expect(data.notes).toContain("Codice Fiscale: RSSMRA90A15H501Y");
    expect(data.notes).toContain("Anamnesi esistente");
  });

  it("does not overwrite populated fields", () => {
    const { data, updatedFields } = buildMacosPatientMergeUpdate(
      {
        ...existing,
        birthDate: new Date(1990, 7, 15),
        gender: Gender.FEMALE,
        notes: "Codice Fiscale: EXISTINGCF123456\nAnamnesi esistente",
      },
      {
        birthDate: "01/01/2000",
        gender: "M",
        codiceFiscale: "RSSMRA90A15H501Y",
      },
    );

    expect(updatedFields).toEqual([]);
    expect(data.birthDate).toBeUndefined();
    expect(data.gender).toBeUndefined();
    expect(data.notes).toBeUndefined();
  });
});

describe("mergeMissingPatientFieldsFromMacosScan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates the patient when missing fields are present", async () => {
    mocks.patient.findUnique.mockResolvedValue({
      id: "patient-1",
      firstName: "Mario",
      lastName: "Rossi",
      email: null,
      phone: null,
      birthDate: null,
      gender: Gender.NOT_SPECIFIED,
      notes: null,
    });
    mocks.patient.update.mockResolvedValue(undefined);

    const result = await mergeMissingPatientFieldsFromMacosScan("patient-1", {
      birthDate: "15/08/1990",
      gender: "M",
      codiceFiscale: "RSSMRA90A15H501Y",
    });

    expect(result).toEqual({
      patientId: "patient-1",
      updatedFields: ["birthDate", "gender", "codiceFiscale"],
    });
    expect(mocks.patient.update).toHaveBeenCalledOnce();
  });
});