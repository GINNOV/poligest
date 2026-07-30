import { describe, expect, it } from "vitest";
import {
  buildFieldFillPlan,
  classifyDuplicateGroup,
  hasStrongMatchSignal,
  type MergePatientSnapshot,
} from "@/lib/patients/duplicate-merge-plan";
import { EMPTY_ATTACHMENT_COUNTS } from "@/lib/patients/duplicate-attachments";
import type { PotentialDuplicateGroup } from "@/lib/patients/duplicate-detection";

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
  it("is true for taxId with >= 2 patients", () => {
    expect(hasStrongMatchSignal([{ kind: "taxId", label: "CF", value: "X", patientIds: ["a", "b"] }])).toBe(true);
  });

  it("is true for nameBirthDate plus phone with overlapping patientIds", () => {
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

  it("is false for nameBirthDate + phone with disjoint patientIds", () => {
    expect(
      hasStrongMatchSignal([
        { kind: "nameBirthDate", label: "N", value: "v", patientIds: ["a", "b"] },
        { kind: "phone", label: "T", value: "v", patientIds: ["c", "d"] },
      ]),
    ).toBe(false);
  });

  it("is true for nameBirthDate + email with overlapping patientIds", () => {
    expect(
      hasStrongMatchSignal([
        { kind: "nameBirthDate", label: "N", value: "v", patientIds: ["a", "b", "c"] },
        { kind: "email", label: "E", value: "v", patientIds: ["b", "c"] },
      ]),
    ).toBe(true);
  });

  it("is false for nameBirthDate + phone overlapping on only one patient", () => {
    expect(
      hasStrongMatchSignal([
        { kind: "nameBirthDate", label: "N", value: "v", patientIds: ["a", "b"] },
        { kind: "phone", label: "T", value: "v", patientIds: ["b", "c"] },
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

  it("is unsafe when delete target has missing counts map entry", () => {
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
    // Only keeper present — missing shell counts must fail closed (not safe).
    const counts = new Map([["keep", { ...EMPTY_ATTACHMENT_COUNTS, paymentCount: 1 }]]);
    const result = classifyDuplicateGroup(group, counts);
    expect(result.safe).toBe(false);
    expect(result.autoEligible).toBe(false);
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
      snap("keep", { notes: "Codice Fiscale: KEEPID" }),
      [snap("shell", { notes: "Codice Fiscale: SHELLID" })],
    );
    expect(plan.filledFields).not.toContain("codiceFiscale");
    // CF not filled => notes unchanged / undefined, and never contains shell CF
    expect(plan.data.notes).toBeUndefined();
  });

  it("preserves freeform keeper lines after CF fill", () => {
    const plan = buildFieldFillPlan(
      snap("keep", { notes: "Allergico al lattice\nVisita urgente" }),
      [snap("shell", { notes: "Codice Fiscale: RSSMRA80A01H501U" })],
    );
    expect(plan.filledFields).toContain("codiceFiscale");
    expect(plan.data.notes).toContain("Allergico al lattice");
    expect(plan.data.notes).toContain("Visita urgente");
    expect(plan.data.notes).toContain("Codice Fiscale: RSSMRA80A01H501U");
  });

  it("keeps keeper CF when shell also has CF (notes undefined or still keeper CF)", () => {
    const plan = buildFieldFillPlan(
      snap("keep", { notes: "Codice Fiscale: KEEPID\nLibera" }),
      [snap("shell", { notes: "Codice Fiscale: SHELLID" })],
    );
    expect(plan.filledFields).not.toContain("codiceFiscale");
    // No structured fill occurred; freeform already on keeper so no notes rewrite required
    if (plan.data.notes != null) {
      expect(plan.data.notes).toContain("KEEPID");
      expect(plan.data.notes).not.toContain("SHELLID");
    } else {
      expect(plan.data.notes).toBeUndefined();
    }
  });

  it("multi-loser createdAt order: earlier phone wins", () => {
    const plan = buildFieldFillPlan(
      snap("keep", { phone: null }),
      [
        snap("later", {
          phone: "+393330000002",
          createdAt: new Date("2026-01-03T10:00:00.000Z"),
        }),
        snap("earlier", {
          phone: "+393330000001",
          createdAt: new Date("2026-01-02T10:00:00.000Z"),
        }),
      ],
    );
    expect(plan.data.phone).toBe("+393330000001");
    expect(plan.filledFields).toContain("phone");
  });

  it("taxId snapshot field fills CF when notes lack it", () => {
    const plan = buildFieldFillPlan(
      snap("keep", { notes: null, taxId: null }),
      [
        snap("shell", {
          notes: null,
          taxId: "RSSMRA80A01H501U",
        }),
      ],
    );
    expect(plan.filledFields).toContain("codiceFiscale");
    expect(plan.data.notes).toBe("Codice Fiscale: RSSMRA80A01H501U");
  });

  it("has no notes key when only phone fills", () => {
    const plan = buildFieldFillPlan(
      snap("keep", { phone: null, notes: null }),
      [snap("shell", { phone: "+393331111111", notes: null })],
    );
    expect(plan.data.phone).toBe("+393331111111");
    expect(plan.data).not.toHaveProperty("notes");
    expect(plan.filledFields).toEqual(["phone"]);
  });

  it("takes freeform from first loser when keeper notes are null", () => {
    const plan = buildFieldFillPlan(
      snap("keep", { notes: null }),
      [
        snap("shell", {
          notes: "Paziente ansioso\nChiamare la mattina",
        }),
      ],
    );
    expect(plan.data.notes).toContain("Paziente ansioso");
    expect(plan.data.notes).toContain("Chiamare la mattina");
  });

  it("prefers earlier loser freeform when keeper freeform empty", () => {
    const plan = buildFieldFillPlan(
      snap("keep", { notes: "Codice Fiscale: KEEPID" }),
      [
        snap("later", {
          notes: "Nota tardi",
          createdAt: new Date("2026-01-03T10:00:00.000Z"),
        }),
        snap("earlier", {
          notes: "Nota presto",
          createdAt: new Date("2026-01-02T10:00:00.000Z"),
        }),
      ],
    );
    expect(plan.data.notes).toContain("Nota presto");
    expect(plan.data.notes).not.toContain("Nota tardi");
    expect(plan.data.notes).toContain("Codice Fiscale: KEEPID");
  });
});
