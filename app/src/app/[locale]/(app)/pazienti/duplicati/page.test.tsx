import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import { completeDuplicatePatient, invalidBirthDatePatient } from "../../../../../../tests/fixtures/patient-records";

const mocks = vi.hoisted(() => {
  const requireUser = vi.fn();
  const requireFeatureAccess = vi.fn();
  const loadFullAttachmentCounts = vi.fn();
  const getAutoMergeEmptyDuplicates = vi.fn();
  const prisma = {
    patient: {
      findMany: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
    },
  };

  return {
    requireUser,
    requireFeatureAccess,
    loadFullAttachmentCounts,
    getAutoMergeEmptyDuplicates,
    prisma,
  };
});

vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/feature-access", () => ({
  requireFeatureAccess: mocks.requireFeatureAccess,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/user-display-time-zone.server", () => ({
  getUserDisplayTimeZone: vi.fn().mockResolvedValue("Europe/Rome"),
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

vi.mock("@/lib/practice-settings", () => ({
  getAutoMergeEmptyDuplicates: mocks.getAutoMergeEmptyDuplicates,
}));

vi.mock("@/components/patient-duplicate-resolve-button", () => ({
  PatientDuplicateResolveButton: () => null,
}));

vi.mock("@/components/patient-duplicate-merge-button", () => ({
  PatientDuplicateMergeButton: () => null,
}));

vi.mock("@/components/patient-duplicate-bulk-merge-button", () => ({
  PatientDuplicateBulkMergeButton: () => null,
}));

vi.mock("@/components/auto-merge-duplicates-setting", () => ({
  AutoMergeDuplicatesSetting: () => null,
}));

vi.mock("@/components/patient-delete-button", () => ({
  PatientDeleteButton: () => null,
}));

import PazientiDuplicatiPage from "./page";
import { EMPTY_ATTACHMENT_COUNTS } from "@/lib/patients/duplicate-attachments";

function emptyCountsMap(ids: string[]) {
  return new Map(ids.map((id) => [id, { ...EMPTY_ATTACHMENT_COUNTS }]));
}

describe("PazientiDuplicatiPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "staff-1", role: Role.ADMIN });
    mocks.requireFeatureAccess.mockResolvedValue(undefined);
    mocks.prisma.auditLog.findMany.mockResolvedValue([]);
    mocks.getAutoMergeEmptyDuplicates.mockResolvedValue(false);
    mocks.loadFullAttachmentCounts.mockImplementation(async (ids: string[]) => emptyCountsMap(ids));
  });

  it("renders duplicate groups when one persisted birth date is invalid", async () => {
    mocks.prisma.patient.findMany.mockResolvedValue([
      {
        ...invalidBirthDatePatient,
        photoUrl: invalidBirthDatePatient.photoUrl,
        hasPaperConsentForRequired: invalidBirthDatePatient.hasPaperConsentForRequired,
        gender: invalidBirthDatePatient.gender,
      },
      {
        ...completeDuplicatePatient,
        photoUrl: null,
        hasPaperConsentForRequired: false,
        gender: "UNKNOWN",
      },
    ]);

    await expect(
      PazientiDuplicatiPage({
        searchParams: Promise.resolve({ q: "catapano" }),
      }),
    ).resolves.toBeTruthy();
  });

  it("marks suggested keeper for empty-shell duplicate groups", async () => {
    mocks.prisma.patient.findMany.mockResolvedValue([
      {
        ...invalidBirthDatePatient,
        photoUrl: invalidBirthDatePatient.photoUrl,
        hasPaperConsentForRequired: invalidBirthDatePatient.hasPaperConsentForRequired,
        gender: invalidBirthDatePatient.gender,
      },
      {
        ...completeDuplicatePatient,
        photoUrl: null,
        hasPaperConsentForRequired: false,
        gender: "UNKNOWN",
      },
    ]);

    const tree = await PazientiDuplicatiPage({
      searchParams: Promise.resolve({ q: "catapano" }),
    });

    const texts: string[] = [];
    const walk = (node: unknown) => {
      if (node == null || typeof node === "boolean") return;
      if (typeof node === "string" || typeof node === "number") {
        texts.push(String(node));
        return;
      }
      if (Array.isArray(node)) {
        for (const child of node) walk(child);
        return;
      }
      if (typeof node === "object" && "props" in node) {
        const props = (node as { props?: { children?: unknown } }).props;
        walk(props?.children);
      }
    };
    walk(tree);

    expect(texts.join(" ")).toContain("Consigliata da mantenere");
    expect(mocks.loadFullAttachmentCounts).toHaveBeenCalled();
  });
});
