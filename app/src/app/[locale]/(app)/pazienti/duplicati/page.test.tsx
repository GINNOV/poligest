import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import { completeDuplicatePatient, invalidBirthDatePatient } from "../../../../../../tests/fixtures/patient-records";

const mocks = vi.hoisted(() => {
  const requireUser = vi.fn();
  const requireFeatureAccess = vi.fn();
  const prisma = {
    patient: {
      findMany: vi.fn(),
    },
    patientPayment: {
      groupBy: vi.fn(),
    },
    dentalRecord: {
      groupBy: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
    },
  };

  return { requireUser, requireFeatureAccess, prisma };
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

vi.mock("@/components/patient-duplicate-resolve-button", () => ({
  PatientDuplicateResolveButton: () => null,
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
    mocks.prisma.patientPayment.groupBy.mockResolvedValue([]);
    mocks.prisma.dentalRecord.groupBy.mockResolvedValue([]);
    mocks.prisma.auditLog.findMany.mockResolvedValue([]);
  });

  it("renders duplicate groups when one persisted birth date is invalid", async () => {
    mocks.prisma.patient.findMany.mockResolvedValue([
      invalidBirthDatePatient,
      completeDuplicatePatient,
    ]);

    await expect(
      PazientiDuplicatiPage({
        searchParams: Promise.resolve({ q: "catapano" }),
      }),
    ).resolves.toBeTruthy();
  });
});
