import { beforeEach, describe, expect, it, vi } from "vitest";
import type React from "react";
import { Role } from "@prisma/client";
import { patientDetailPageData } from "../../../../../../tests/fixtures/patient-records";

const mocks = vi.hoisted(() => {
  const requireUser = vi.fn();
  const requireFeatureAccess = vi.fn();
  const getRoleFeatureAccess = vi.fn();
  const getPatientDetailPageData = vi.fn();
  const getUserDisplayTimeZone = vi.fn();
  const prisma = {
    patient: {
      findUnique: vi.fn(),
    },
  };

  return {
    requireUser,
    requireFeatureAccess,
    getRoleFeatureAccess,
    getPatientDetailPageData,
    getUserDisplayTimeZone,
    prisma,
  };
});

vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/feature-access", () => ({
  requireFeatureAccess: mocks.requireFeatureAccess,
  getRoleFeatureAccess: mocks.getRoleFeatureAccess,
}));

vi.mock("@/lib/patients/page-data", () => ({
  getPatientDetailPageData: mocks.getPatientDetailPageData,
}));

vi.mock("@/lib/patients/actions", () => ({
  addImplantAssociationAction: vi.fn(),
  resetPhotoAction: vi.fn(),
  revokeConsentAction: vi.fn(),
  sendPatientAccessEmailAction: vi.fn(),
  sendPatientSmsAction: vi.fn(),
  updateImplantAssociationAction: vi.fn(),
  updatePatientAction: vi.fn(),
  uploadPhotoAction: vi.fn(),
}));

vi.mock("@/lib/user-display-time-zone.server", () => ({
  getUserDisplayTimeZone: mocks.getUserDisplayTimeZone,
}));

vi.mock("@/components/patient-avatar", () => ({
  PatientAvatar: () => null,
}));

vi.mock("@/components/patient-photo-dialog", () => ({
  PatientPhotoDialog: () => null,
}));

vi.mock("@/components/dental-chart", () => ({
  DentalChart: () => null,
}));

vi.mock("@/components/patient-anamnesis-notes", () => ({
  PatientAnamnesisNotes: () => null,
}));

vi.mock("@/components/consent-form", () => ({
  ConsentForm: () => null,
}));

vi.mock("@/components/unsaved-changes-guard", () => ({
  UnsavedChangesGuard: () => null,
}));

vi.mock("@/components/page-toast-trigger", () => ({
  PageToastTrigger: () => null,
}));

vi.mock("@/components/patient-delete-button", () => ({
  PatientDeleteButton: () => null,
}));

vi.mock("@/components/print-link-button", () => ({
  PrintLinkButton: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/form-submit-button", () => ({
  FormSubmitButton: ({ children }: { children?: React.ReactNode }) => <button type="submit">{children}</button>,
}));

import PatientDetailPage from "./page";

describe("PatientDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "staff-1", role: Role.ADMIN });
    mocks.requireFeatureAccess.mockResolvedValue(undefined);
    mocks.getRoleFeatureAccess.mockResolvedValue({
      isAllowed: vi.fn().mockReturnValue(true),
    });
    mocks.getPatientDetailPageData.mockResolvedValue(patientDetailPageData);
    mocks.getUserDisplayTimeZone.mockResolvedValue("Europe/Rome");
  });

  it("renders dirty production patient data with an invalid persisted birth date", async () => {
    await expect(
      PatientDetailPage({
        params: Promise.resolve({ id: "cmp1eereh000004jti3koxnm3" }),
        searchParams: Promise.resolve({}),
      }),
    ).resolves.toBeTruthy();
  });
});
