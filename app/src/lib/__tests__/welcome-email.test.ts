import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  sendEmailTemplate: vi.fn(),
}));

vi.mock("@/lib/email-templates", () => ({
  sendEmailTemplate: mocks.sendEmailTemplate,
}));

import {
  buildWelcomeEmailData,
  sendPatientWelcomeEmail,
  sendStaffWelcomeEmail,
  WELCOME_PATIENT_TEMPLATE,
  WELCOME_STAFF_TEMPLATE,
} from "@/lib/welcome-email";

describe("welcome-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendEmailTemplate.mockResolvedValue(undefined);
  });

  it("builds shared welcome data with clinic name and login url", () => {
    expect(
      buildWelcomeEmailData({
        patientName: "Maria Rossi",
        loginUrl: "https://example.com/login",
      }),
    ).toEqual({
      patientName: "Maria Rossi",
      staffRole: "",
      clinicName: "Studio Agovino & Angrisano",
      websiteUrl: "https://example.com/login",
      customNote: "",
    });
  });

  it("sends staff welcome email with role label", async () => {
    await sendStaffWelcomeEmail("staff@example.com", Role.SECRETARY);

    expect(mocks.sendEmailTemplate).toHaveBeenCalledWith({
      to: "staff@example.com",
      templateName: WELCOME_STAFF_TEMPLATE,
      data: expect.objectContaining({
        staffRole: "Segreteria",
        clinicName: "Studio Agovino & Angrisano",
      }),
    });
  });

  it("sends patient welcome email with login url and CTA label", async () => {
    await sendPatientWelcomeEmail("patient@example.com", {
      patientName: "Maria Rossi",
      loginUrl: "https://example.com/patient-login",
    });

    expect(mocks.sendEmailTemplate).toHaveBeenCalledWith({
      to: "patient@example.com",
      templateName: WELCOME_PATIENT_TEMPLATE,
      data: expect.objectContaining({
        patientName: "Maria Rossi",
        websiteUrl: "https://example.com/patient-login",
        buttonLabel: "Accedi all'area paziente",
      }),
    });
  });
});