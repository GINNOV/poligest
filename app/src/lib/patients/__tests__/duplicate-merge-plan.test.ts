import { describe, expect, it } from "vitest";
import { EMPTY_ATTACHMENT_COUNTS } from "@/lib/patients/duplicate-attachments";
import type { PotentialDuplicateGroup } from "@/lib/patients/duplicate-detection";
import {
  buildFieldFillPlan,
  classifyDuplicateGroup,
  hasStrongMatchSignal,
  type MergePatientSnapshot,
} from "@/lib/patients/duplicate-merge-plan";

const snap = (
  id: string,
  overrides: Partial<MergePatientSnapshot> = {},
): MergePatientSnapshot => ({
  id,
  firstName: "Mario",
  lastName: "Rossi",
  email: null,
  phone: null,
  birthDate: null,
  gender: "NOT_SPECIFIED",
  notes: null,
  photoUrl: null,
  hasPaperConsentForRequired: false,
  taxId: null,
  createdAt: new Date("2026-01-01T10:00:00.000Z"),
  ...overrides,
});

describe("hasStrongMatchSignal", () => {
  it("is true for taxId", () => {
    expect(hasStrongMatchSignal([{ kind: "taxId", label: "CF", value: "X", patientIds: ["a", "b"] }])).toBe(true);
  });

  it("is true for nameBirthDate plus phone", () => {
    expect(
      hasStrongMatchSignal([
        { kind: "nameBirthDate", label: "N", value: "v", patientIds: ["a", "b"] },
        { kind: "phone", label: "T", value: "v", patientIds: ["a", "b"] },
      ]),
    ).toBe(true);
  });

  it("is false for nameBirthDate alone", () => {
    expect(
      hasStrongMatchSignal([{ kind: "nameBirthDate", label: "N", value: "v", patientIds: ["a", "b"] }]),
    ).toBe(false);
  });

  it("is false when nameBirthDate and phone cover disjoint patient sets", () => {
    expect(
      hasStrongMatchSignal([
        { kind: "nameBirthDate", label: "N", value: "v", patientIds: ["a", "b"] },
        { kind: "phone", label: "T", value: "v", patientIds: ["c", "d"] },
      ]),
    ).toBe(false);
  });
});

describe("classifyDuplicateGroup", () => {
  it("marks group safe when only keeper has attachments", () => {
    const group: PotentialDuplicateGroup = {
      id: "g1",
      matchSignals: [{ kind: "taxId", label: "CF", value: "RSSMRA80A01H501U", patientIds: ["keep", "shell"] }],
      patients: [
        {
          id: "keep",
          firstName: "Mario",
          lastName: "Rossi",
          email: "m@example.com",
          phone: null,
          birthDate: null,
          taxId: "RSSMRA80A01H501U",
          createdAt: new Date("2026-01-01"),
        },
        {
          id: "shell",
          firstName: "Mario",
          lastName: "Rossi",
          email: null,
          phone: "+393331111111",
          birthDate: new Date("1980-01-01"),
          taxId: "RSSMRA80A01H501U",
          createdAt: new Date("2026-01-02"),
        },
      ],
    };
    const counts = new Map([
      ["keep", { ...EMPTY_ATTACHMENT_COUNTS, paymentCount: 1 }],
      ["shell", { ...EMPTY_ATTACHMENT_COUNTS }],
    ]);
    const result = classifyDuplicateGroup(group, counts);
    expect(result.safe).toBe(true);
    expect(result.autoEligible).toBe(true);
    expect(result.keepPatientId).toBe("keep");
    expect(result.deletePatientIds).toEqual(["shell"]);
  });

  it("is unsafe when two patients have attachments", () => {
    const group: PotentialDuplicateGroup = {
      id: "g2",
      matchSignals: [{ kind: "taxId", label: "CF", value: "X", patientIds: ["a", "b"] }],
      patients: [
        { id: "a", firstName: "A", lastName: "A", email: null, phone: null, birthDate: null, taxId: "X", createdAt: new Date() },
        { id: "b", firstName: "B", lastName: "B", email: null, phone: null, birthDate: null, taxId: "X", createdAt: new Date() },
      ],
    };
    const counts = new Map([
      ["a", { ...EMPTY_ATTACHMENT_COUNTS, appointmentCount: 1 }],
      ["b", { ...EMPTY_ATTACHMENT_COUNTS, dentalRecordCount: 1 }],
    ]);
    expect(classifyDuplicateGroup(group, counts).safe).toBe(false);
  });

  it("is not safe when delete-target counts are missing (fail closed)", () => {
    const group: PotentialDuplicateGroup = {
      id: "g3",
      matchSignals: [{ kind: "taxId", label: "CF", value: "X", patientIds: ["keep", "shell"] }],
      patients: [
        {
          id: "keep",
          firstName: "Mario",
          lastName: "Rossi",
          email: null,
          phone: null,
          birthDate: null,
          taxId: "X",
          createdAt: new Date("2026-01-01"),
        },
        {
          id: "shell",
          firstName: "Mario",
          lastName: "Rossi",
          email: null,
          phone: null,
          birthDate: null,
          taxId: "X",
          createdAt: new Date("2026-01-02"),
        },
      ],
    };
    const counts = new Map([["keep", { ...EMPTY_ATTACHMENT_COUNTS, paymentCount: 1 }]]);
    expect(classifyDuplicateGroup(group, counts).safe).toBe(false);
  });
});

describe("buildFieldFillPlan", () => {
  it("fills only empty keeper fields from losers", () => {
    const plan = buildFieldFillPlan(
      snap("keep", { email: "keep@example.com", phone: null, notes: null }),
      [snap("shell", { email: "other@example.com", phone: "+393339999999", notes: "Codice Fiscale: RSSMRA80A01H501U" })],
    );
    expect(plan.filledFields).toEqual(expect.arrayContaining(["phone", "codiceFiscale"]));
    expect(plan.data.email).toBeUndefined();
    expect(plan.data.phone).toBe("+393339999999");
  });

  it("does not overwrite existing tax id in notes", () => {
    const plan = buildFieldFillPlan(
      snap("keep", { notes: "Codice Fiscale: KEEPIDXXXXXXXXX", taxId: "KEEPIDXXXXXXXXX" }),
      [snap("shell", { notes: "Codice Fiscale: SHELLIDXXXXXXXX" })],
    );
    expect(plan.filledFields).not.toContain("codiceFiscale");
  });
});
