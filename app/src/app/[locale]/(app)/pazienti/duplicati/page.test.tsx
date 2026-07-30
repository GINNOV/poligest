import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import { completeDuplicatePatient, invalidBirthDatePatient } from "../../../../../../tests/fixtures/patient-records";

const mocks = vi.hoisted(() => {
  const requireUser = vi.fn();
  const requireFeatureAccess = vi.fn();
  const groupBy = vi.fn().mockResolvedValue([]);
  const prisma = {
    patient: {
      findMany: vi.fn(),
    },
    appointment: { groupBy },
    appointmentReminder: { groupBy },
    patientPayment: { groupBy },
    quote: { groupBy },
    cashAdvance: { groupBy },
    financeEntry: { groupBy },
    dentalRecord: { groupBy },
    clinicalNote: { groupBy },
    patientConsent: { groupBy },
    recall: { groupBy },
    recurringMessageLog: { groupBy },
    stockMovement: { groupBy },
    smsLog: { groupBy },
    auditLog: {
      findMany: vi.fn(),
    },
  };

  return { requireUser, requireFeatureAccess, prisma, groupBy };
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

vi.mock("@/lib/practice-settings", () => ({
  getAutoMergeEmptyDuplicates: vi.fn().mockResolvedValue(false),
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

describe("PazientiDuplicatiPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "staff-1", role: Role.ADMIN });
    mocks.requireFeatureAccess.mockResolvedValue(undefined);
    mocks.groupBy.mockResolvedValue([]);
    mocks.prisma.auditLog.findMany.mockResolvedValue([]);
  });

  it("renders duplicate groups when one persisted birth date is invalid", async () => {
    mocks.prisma.patient.findMany.mockResolvedValue([
      { ...invalidBirthDatePatient, taxId: null, gender: "NOT_SPECIFIED", photoUrl: null, hasPaperConsentForRequired: false },
      { ...completeDuplicatePatient, taxId: null, gender: "NOT_SPECIFIED", photoUrl: null, hasPaperConsentForRequired: false },
    ]);

    await expect(
      PazientiDuplicatiPage({
        searchParams: Promise.resolve({ q: "catapano" }),
      }),
    ).resolves.toBeTruthy();
  });
});
