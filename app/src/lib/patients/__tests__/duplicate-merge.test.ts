import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_ATTACHMENT_COUNTS } from "@/lib/patients/duplicate-attachments";
import type { FullPatientAttachmentCounts } from "@/lib/patients/duplicate-attachments";

const mocks = vi.hoisted(() => {
  const prisma = {
    patient: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  return {
    prisma,
    loadFullAttachmentCounts: vi.fn(),
    deletePatientWithRelations: vi.fn(),
    logAudit: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/patients/duplicate-attachments", async () => {
  const actual = await vi.importActual<typeof import("@/lib/patients/duplicate-attachments")>(
    "@/lib/patients/duplicate-attachments",
  );
  return {
    ...actual,
    loadFullAttachmentCounts: mocks.loadFullAttachmentCounts,
  };
});

vi.mock("@/lib/patients/delete-patient", () => ({
  deletePatientWithRelations: mocks.deletePatientWithRelations,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mocks.logAudit,
}));

import {
  mergeAllSafeEmptyShellGroups,
  mergeEmptyDuplicateShells,
} from "@/lib/patients/duplicate-merge";

const actor = { id: "admin-1", role: "ADMIN" as const };

function emptyMap(ids: string[]): Map<string, FullPatientAttachmentCounts> {
  const map = new Map<string, FullPatientAttachmentCounts>();
  for (const id of ids) {
    map.set(id, { ...EMPTY_ATTACHMENT_COUNTS });
  }
  return map;
}

function patientRow(
  id: string,
  overrides: Partial<{
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    birthDate: Date | null;
    gender: string;
    notes: string | null;
    photoUrl: string | null;
    hasPaperConsentForRequired: boolean;
    createdAt: Date;
  }> = {},
) {
  return {
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
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    ...overrides,
  };
}

describe("mergeEmptyDuplicateShells", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback(mocks.prisma),
    );
    mocks.prisma.patient.update.mockResolvedValue({});
    mocks.deletePatientWithRelations.mockResolvedValue(undefined);
    mocks.logAudit.mockResolvedValue(undefined);
  });

  it("rejects INVALID when delete list is empty or includes keep", async () => {
    const empty = await mergeEmptyDuplicateShells({
      keepPatientId: "keep-1",
      deletePatientIds: [],
      actor,
      trigger: "ui",
    });
    expect(empty).toMatchObject({
      ok: false,
      code: "INVALID",
    });

    const self = await mergeEmptyDuplicateShells({
      keepPatientId: "keep-1",
      deletePatientIds: ["keep-1"],
      actor,
      trigger: "ui",
    });
    expect(self.ok).toBe(false);
    if (!self.ok) expect(self.code).toBe("INVALID");
    expect(mocks.loadFullAttachmentCounts).not.toHaveBeenCalled();
  });

  it("rejects when a delete target has attachments", async () => {
    mocks.loadFullAttachmentCounts.mockResolvedValue(
      new Map([
        ["keep-1", { ...EMPTY_ATTACHMENT_COUNTS }],
        ["loser-1", { ...EMPTY_ATTACHMENT_COUNTS, appointmentCount: 1 }],
      ]),
    );

    const result = await mergeEmptyDuplicateShells({
      keepPatientId: "keep-1",
      deletePatientIds: ["loser-1"],
      actor,
      trigger: "ui",
    });

    expect(result).toMatchObject({ ok: false, code: "NOT_EMPTY" });
    expect(mocks.prisma.patient.findMany).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.deletePatientWithRelations).not.toHaveBeenCalled();
  });

  it("updates keeper then deletes empty losers and returns filled fields", async () => {
    mocks.loadFullAttachmentCounts.mockResolvedValue(emptyMap(["keep-1", "loser-1"]));
    mocks.prisma.patient.findMany.mockResolvedValue([
      patientRow("keep-1", {
        email: null,
        phone: "3331111111",
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
      }),
      patientRow("loser-1", {
        email: "mario@example.com",
        phone: null,
        notes: "Codice Fiscale: RSSMRA80A01H501U",
        createdAt: new Date("2026-01-02T10:00:00.000Z"),
      }),
    ]);

    const result = await mergeEmptyDuplicateShells({
      keepPatientId: "keep-1",
      deletePatientIds: ["loser-1", "loser-1"],
      actor,
      trigger: "ui",
    });

    expect(result).toEqual({
      ok: true,
      keepPatientId: "keep-1",
      deletedPatientIds: ["loser-1"],
      filledFields: expect.arrayContaining(["email", "codiceFiscale"]),
    });
    if (result.ok) {
      expect(result.filledFields).toContain("email");
      expect(result.filledFields).toContain("codiceFiscale");
    }

    expect(mocks.prisma.$transaction).toHaveBeenCalledOnce();
    expect(mocks.prisma.patient.update).toHaveBeenCalledWith({
      where: { id: "keep-1" },
      data: expect.objectContaining({
        email: "mario@example.com",
        notes: expect.stringContaining("RSSMRA80A01H501U"),
      }),
    });
    expect(mocks.deletePatientWithRelations).toHaveBeenCalledWith("loser-1", mocks.prisma);
    expect(mocks.logAudit).toHaveBeenCalledWith(actor, {
      action: "patient.duplicates_merged",
      entity: "Patient",
      entityId: "keep-1",
      metadata: expect.objectContaining({
        filledFields: expect.arrayContaining(["email", "codiceFiscale"]),
        trigger: "ui",
      }),
    });
  });

  it("returns NOT_FOUND when a patient row is missing", async () => {
    mocks.loadFullAttachmentCounts.mockResolvedValue(emptyMap(["keep-1", "loser-1"]));
    mocks.prisma.patient.findMany.mockResolvedValue([patientRow("keep-1")]);

    const result = await mergeEmptyDuplicateShells({
      keepPatientId: "keep-1",
      deletePatientIds: ["loser-1"],
      actor,
      trigger: "bulk",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("requireStrong rejects weak-only name+birthDate matches", async () => {
    const birthDate = new Date("1980-01-01T00:00:00.000Z");
    mocks.loadFullAttachmentCounts.mockResolvedValue(emptyMap(["keep-1", "loser-1"]));
    mocks.prisma.patient.findMany.mockResolvedValue([
      patientRow("keep-1", {
        firstName: "Mario",
        lastName: "Rossi",
        birthDate,
        email: null,
        phone: null,
        notes: null,
      }),
      patientRow("loser-1", {
        firstName: "Mario",
        lastName: "Rossi",
        birthDate,
        email: null,
        phone: null,
        notes: null,
        createdAt: new Date("2026-01-03T10:00:00.000Z"),
      }),
    ]);

    const result = await mergeEmptyDuplicateShells({
      keepPatientId: "keep-1",
      deletePatientIds: ["loser-1"],
      actor,
      trigger: "cron",
      requireStrong: true,
    });

    expect(result).toMatchObject({ ok: false, code: "NOT_STRONG" });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.logAudit).not.toHaveBeenCalled();
  });

  it("requireStrong accepts taxId match and uses auto_merged audit for cron", async () => {
    const taxNotes = "Codice Fiscale: RSSMRA80A01H501U";
    mocks.loadFullAttachmentCounts.mockResolvedValue(emptyMap(["keep-1", "loser-1"]));
    mocks.prisma.patient.findMany.mockResolvedValue([
      patientRow("keep-1", {
        firstName: "Mario",
        lastName: "Rossi",
        notes: taxNotes,
        email: "keep@example.com",
      }),
      patientRow("loser-1", {
        firstName: "Mario",
        lastName: "Rossi",
        notes: taxNotes,
        phone: "3339999999",
        createdAt: new Date("2026-02-01T10:00:00.000Z"),
      }),
    ]);

    const result = await mergeEmptyDuplicateShells({
      keepPatientId: "keep-1",
      deletePatientIds: ["loser-1"],
      actor,
      trigger: "cron",
      requireStrong: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.filledFields).toContain("phone");
    }
    expect(mocks.deletePatientWithRelations).toHaveBeenCalledWith("loser-1", mocks.prisma);
    expect(mocks.logAudit).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        action: "patient.duplicates_auto_merged",
        metadata: expect.objectContaining({ trigger: "cron" }),
      }),
    );
  });
});

describe("mergeAllSafeEmptyShellGroups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback(mocks.prisma),
    );
    mocks.prisma.patient.update.mockResolvedValue({});
    mocks.deletePatientWithRelations.mockResolvedValue(undefined);
    mocks.logAudit.mockResolvedValue(undefined);
  });

  it("merges safe empty groups and counts results", async () => {
    const taxNotes = "Codice Fiscale: RSSMRA80A01H501U";
    const keep = patientRow("keep-1", {
      notes: taxNotes,
      email: "keep@example.com",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
    });
    const loser = patientRow("loser-1", {
      notes: taxNotes,
      phone: "3330000000",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    // Unrelated non-duplicate patient
    const other = patientRow("other-1", {
      firstName: "Luigi",
      lastName: "Verdi",
    });

    mocks.prisma.patient.findMany.mockImplementation(async (args?: { where?: { id?: { in?: string[] } } }) => {
      const all = [keep, loser, other];
      const ids = args?.where?.id?.in;
      if (!ids) return all;
      return all.filter((row) => ids.includes(row.id));
    });

    mocks.loadFullAttachmentCounts.mockImplementation(async (ids: string[]) => emptyMap(ids));

    const summary = await mergeAllSafeEmptyShellGroups({
      actor,
      trigger: "bulk",
      autoEligibleOnly: false,
    });

    expect(summary.merged).toBe(1);
    expect(summary.deleted).toBe(1);
    expect(summary.errors).toEqual([]);
    expect(mocks.deletePatientWithRelations).toHaveBeenCalledWith("loser-1", mocks.prisma);
  });

  it("skips non-auto-eligible groups when autoEligibleOnly is true", async () => {
    const birthDate = new Date("1980-01-01T00:00:00.000Z");
    // Weak only: same name + birthDate, no contact/taxId
    const keep = patientRow("keep-w", {
      firstName: "Anna",
      lastName: "Bianchi",
      birthDate,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
    });
    const loser = patientRow("loser-w", {
      firstName: "Anna",
      lastName: "Bianchi",
      birthDate,
      email: "anna@example.com",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    mocks.prisma.patient.findMany.mockResolvedValue([keep, loser]);
    mocks.loadFullAttachmentCounts.mockImplementation(async (ids: string[]) => emptyMap(ids));

    const summary = await mergeAllSafeEmptyShellGroups({
      actor,
      trigger: "cron",
      autoEligibleOnly: true,
    });

    expect(summary.merged).toBe(0);
    expect(summary.deleted).toBe(0);
    expect(summary.skipped).toBeGreaterThanOrEqual(1);
    expect(mocks.deletePatientWithRelations).not.toHaveBeenCalled();
  });
});
