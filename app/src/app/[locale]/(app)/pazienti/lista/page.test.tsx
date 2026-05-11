import { describe, expect, it, vi, beforeEach } from "vitest";
import { ConsentStatus, Role } from "@prisma/client";

const mocks = vi.hoisted(() => {
  const requireUser = vi.fn();
  const requireFeatureAccess = vi.fn();
  const prisma = {
    patient: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    consentModule: {
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

vi.mock("@/components/patient-list-filters", () => ({
  PatientListFilters: () => null,
}));

vi.mock("@/components/patient-delete-button", () => ({
  PatientDeleteButton: () => null,
}));

import PazientiListaPage from "./page";

describe("PazientiListaPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "staff-1", role: Role.ADMIN });
    mocks.requireFeatureAccess.mockResolvedValue(undefined);
    mocks.prisma.user.findMany.mockResolvedValue([]);
    mocks.prisma.consentModule.findMany.mockResolvedValue([
      { id: "privacy", name: "Privacy" },
    ]);
  });

  it("renders search results when a persisted birth date is invalid", async () => {
    mocks.prisma.patient.findMany.mockResolvedValue([
      {
        id: "patient-1",
        firstName: "Maria",
        lastName: "Catapano",
        email: null,
        phone: "+393421660548",
        photoUrl: "/avatars/avatar_2.jpg",
        birthDate: new Date("invalid-date"),
        notes: null,
        hasPaperConsentForRequired: true,
        consents: [
          {
            moduleId: "privacy",
            status: ConsentStatus.GRANTED,
            module: { name: "Privacy" },
          },
        ],
        createdAt: new Date("2026-05-11T16:10:38.009Z"),
      },
    ]);

    await expect(
      PazientiListaPage({
        searchParams: Promise.resolve({ q: "ca", sort: "name_asc" }),
      }),
    ).resolves.toBeTruthy();
  });
});
