import { Role } from "@prisma/client";
import { DEFAULT_CLINIC_NAME } from "@/lib/brand";
import { sendEmailTemplate } from "@/lib/email-templates";
import { resolveTransactionalSiteOrigin } from "@/lib/email-template-utils";
import { getStaffRoleLabel } from "@/lib/invite-email";

export const WELCOME_STAFF_TEMPLATE = "welcome-staff";
export const WELCOME_PATIENT_TEMPLATE = "welcome-patient";

export function buildWelcomeEmailData(params: {
  patientName?: string;
  staffRole?: string;
  loginUrl?: string;
  customNote?: string;
}) {
  return {
    patientName: params.patientName ?? "",
    staffRole: params.staffRole ?? "",
    clinicName: DEFAULT_CLINIC_NAME,
    websiteUrl: params.loginUrl || resolveTransactionalSiteOrigin(),
    customNote: params.customNote ?? "",
  };
}

export async function sendStaffWelcomeEmail(to: string, role: Role) {
  await sendEmailTemplate({
    to,
    templateName: WELCOME_STAFF_TEMPLATE,
    data: buildWelcomeEmailData({ staffRole: getStaffRoleLabel(role) }),
  });
}

export async function sendPatientWelcomeEmail(
  to: string,
  params: { patientName: string; loginUrl: string },
) {
  await sendEmailTemplate({
    to,
    templateName: WELCOME_PATIENT_TEMPLATE,
    data: {
      ...buildWelcomeEmailData({
        patientName: params.patientName,
        loginUrl: params.loginUrl,
      }),
      buttonLabel: "Accedi all'area paziente",
    },
  });
}