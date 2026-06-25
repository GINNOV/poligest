import { describe, expect, it } from "vitest";
import { filterPotentialDuplicateGroups, findPotentialPatientDuplicates } from "@/lib/patients/duplicate-detection";

describe("findPotentialPatientDuplicates", () => {
  it("groups patients that share strong identifiers", () => {
    const groups = findPotentialPatientDuplicates([
      {
        id: "patient-1",
        firstName: "Mario",
        lastName: "Rossi",
        email: "mario@example.com",
        phone: "+393331234567",
        birthDate: new Date("1980-01-01T00:00:00.000Z"),
        notes: "Codice Fiscale: RSSMRA80A01H501U",
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
      },
      {
        id: "patient-2",
        firstName: "Mario",
        lastName: "Rossi",
        email: "MARIO@example.com",
        phone: "3331234567",
        birthDate: new Date("1980-01-01T00:00:00.000Z"),
        notes: "Codice Fiscale: RSSMRA80A01H501U",
        createdAt: new Date("2026-01-03T10:00:00.000Z"),
      },
      {
        id: "patient-3",
        firstName: "Giulia",
        lastName: "Bianchi",
        email: "giulia@example.com",
        phone: "+393339999999",
        birthDate: new Date("1988-02-02T00:00:00.000Z"),
        notes: "",
        createdAt: new Date("2026-01-02T10:00:00.000Z"),
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].patients.map((patient) => patient.id)).toEqual(["patient-1", "patient-2"]);
    expect(groups[0].matchSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "taxId", value: "RSSMRA80A01H501U" }),
        expect.objectContaining({ kind: "email", value: "rossi|mario|mario@example.com" }),
        expect.objectContaining({ kind: "phone", value: "rossi|mario|+393331234567" }),
        expect.objectContaining({ kind: "nameBirthDate" }),
      ]),
    );
  });

  it("ignores different people who only share a phone number", () => {
    const groups = findPotentialPatientDuplicates([
      {
        id: "patient-1",
        firstName: "Mario",
        lastName: "Rossi",
        email: null,
        phone: "+393331234567",
        birthDate: new Date("1980-01-01T00:00:00.000Z"),
        notes: "",
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
      },
      {
        id: "patient-2",
        firstName: "Giulia",
        lastName: "Rossi",
        email: null,
        phone: "+393331234567",
        birthDate: new Date("1990-02-02T00:00:00.000Z"),
        notes: "",
        createdAt: new Date("2026-01-02T10:00:00.000Z"),
      },
    ]);

    expect(groups).toEqual([]);
  });

  it("ignores same-name records when the birth date is missing", () => {
    const groups = findPotentialPatientDuplicates([
      {
        id: "patient-1",
        firstName: "Anna",
        lastName: "Verdi",
        email: null,
        phone: null,
        birthDate: null,
        notes: "",
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
      },
      {
        id: "patient-2",
        firstName: "Anna",
        lastName: "Verdi",
        email: null,
        phone: null,
        birthDate: null,
        notes: "",
        createdAt: new Date("2026-01-02T10:00:00.000Z"),
      },
    ]);

    expect(groups).toEqual([]);
  });

  it("merges connected matches into one review group", () => {
    const groups = findPotentialPatientDuplicates([
      {
        id: "patient-1",
        firstName: "Luca",
        lastName: "Neri",
        email: "luca@example.com",
        phone: null,
        birthDate: null,
        notes: "",
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
      },
      {
        id: "patient-2",
        firstName: "Luca",
        lastName: "Neri",
        email: "luca@example.com",
        phone: "+393331111111",
        birthDate: null,
        notes: "",
        createdAt: new Date("2026-01-02T10:00:00.000Z"),
      },
      {
        id: "patient-3",
        firstName: "Luca",
        lastName: "Neri",
        email: null,
        phone: "3331111111",
        birthDate: null,
        notes: "",
        createdAt: new Date("2026-01-03T10:00:00.000Z"),
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].patients.map((patient) => patient.id)).toEqual(["patient-1", "patient-2", "patient-3"]);
    expect(groups[0].matchSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "email", patientIds: ["patient-1", "patient-2"] }),
        expect.objectContaining({ kind: "phone", patientIds: ["patient-2", "patient-3"] }),
      ]),
    );
  });

  it("filters duplicate groups by patient and signal text", () => {
    const groups = findPotentialPatientDuplicates([
      {
        id: "patient-1",
        firstName: "Mario",
        lastName: "Rossi",
        email: "mario@example.com",
        phone: "+393331234567",
        birthDate: new Date("1980-01-01T00:00:00.000Z"),
        notes: "Codice Fiscale: RSSMRA80A01H501U",
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
      },
      {
        id: "patient-2",
        firstName: "Mario",
        lastName: "Rossi",
        email: "mario@example.com",
        phone: "+393331234567",
        birthDate: new Date("1980-01-01T00:00:00.000Z"),
        notes: "Codice Fiscale: RSSMRA80A01H501U",
        createdAt: new Date("2026-01-02T10:00:00.000Z"),
      },
      {
        id: "patient-3",
        firstName: "Giulia",
        lastName: "Bianchi",
        email: "giulia@example.com",
        phone: "+393339999999",
        birthDate: new Date("1988-02-02T00:00:00.000Z"),
        notes: "",
        createdAt: new Date("2026-01-03T10:00:00.000Z"),
      },
      {
        id: "patient-4",
        firstName: "Giulia",
        lastName: "Bianchi",
        email: "giulia@example.com",
        phone: "+393339999999",
        birthDate: new Date("1988-02-02T00:00:00.000Z"),
        notes: "",
        createdAt: new Date("2026-01-04T10:00:00.000Z"),
      },
    ]);

    expect(filterPotentialDuplicateGroups(groups, "rssmra")).toHaveLength(1);
    expect(filterPotentialDuplicateGroups(groups, "rssmra")[0].patients.map((patient) => patient.id)).toEqual([
      "patient-1",
      "patient-2",
    ]);
    expect(filterPotentialDuplicateGroups(groups, "giulia bianchi")[0].patients.map((patient) => patient.id)).toEqual([
      "patient-3",
      "patient-4",
    ]);
    expect(filterPotentialDuplicateGroups(groups, "nonexistent")).toEqual([]);
  });
});
