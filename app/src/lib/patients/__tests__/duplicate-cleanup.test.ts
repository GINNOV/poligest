import { describe, expect, it } from "vitest";
import { EMPTY_ATTACHMENT_COUNTS } from "@/lib/patients/duplicate-attachments";
import {
  buildDuplicateCleanupPlan,
  pickPatientToKeep,
  type PatientAttachmentCounts,
} from "@/lib/patients/duplicate-cleanup";
import type { DuplicatePatientRecord } from "@/lib/patients/duplicate-detection";

const basePatient = (
  id: string,
  overrides: Partial<DuplicatePatientRecord> = {},
): DuplicatePatientRecord => ({
  id,
  firstName: "Mario",
  lastName: "Rossi",
  email: null,
  phone: null,
  birthDate: null,
  taxId: null,
  createdAt: new Date("2026-01-01T10:00:00.000Z"),
  ...overrides,
});

describe("pickPatientToKeep", () => {
  it("keeps the patient with payments or dental records attached", () => {
    const patients = [
      basePatient("complete", {
        email: "mario@example.com",
        phone: "+393331234567",
        birthDate: new Date("1980-01-01T00:00:00.000Z"),
        taxId: "RSSMRA80A01H501U",
        createdAt: new Date("2026-01-02T10:00:00.000Z"),
      }),
      basePatient("with-data", {
        phone: "+393331234567",
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
      }),
    ];
    const counts = new Map<string, PatientAttachmentCounts>([
      ["complete", { ...EMPTY_ATTACHMENT_COUNTS }],
      ["with-data", { ...EMPTY_ATTACHMENT_COUNTS, paymentCount: 2, dentalRecordCount: 1 }],
    ]);

    expect(pickPatientToKeep(patients, counts).patientId).toBe("with-data");
  });

  it("keeps the most complete record when none have linked data", () => {
    const patients = [
      basePatient("sparse", { phone: "+393331234567" }),
      basePatient("rich", {
        email: "mario@example.com",
        phone: "+393331234567",
        birthDate: new Date("1980-01-01T00:00:00.000Z"),
        taxId: "RSSMRA80A01H501U",
      }),
    ];

    expect(pickPatientToKeep(patients, new Map()).patientId).toBe("rich");
  });
});

describe("buildDuplicateCleanupPlan", () => {
  it("builds delete actions for every duplicate group", () => {
    const plan = buildDuplicateCleanupPlan(
      [
        {
          id: "group-1",
          matchSignals: [],
          patients: [
            basePatient("keep"),
            basePatient("delete", { phone: "+393331234567" }),
          ],
        },
      ],
      new Map([
        ["keep", { ...EMPTY_ATTACHMENT_COUNTS, paymentCount: 1 }],
        ["delete", { ...EMPTY_ATTACHMENT_COUNTS }],
      ]),
    );

    expect(plan).toEqual([
      {
        groupId: "group-1",
        keepPatientId: "keep",
        deletePatientIds: ["delete"],
        reason: expect.stringContaining("pagamenti"),
      },
    ]);
  });
});