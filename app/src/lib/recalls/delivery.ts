import { sendEmail, sendEmailWithHtml } from "@/lib/email";
import { sendKapsoWhatsAppText } from "@/lib/kapso-whatsapp";
import { sendSms } from "@/lib/sms";
export {
  formatNotificationChannel,
  getNotificationChannelLabels,
  type NotificationChannelLabel,
} from "@/lib/recalls/channel-labels";

export type NotificationDeliveryPlan = {
  wantsEmail: boolean;
  wantsSms: boolean;
  wantsWhatsApp: boolean;
  subject: string;
  body: string;
  html?: string;
};

export async function deliverNotificationPlan(params: {
  patient: { id: string; email: string | null; phone: string | null };
  plan: NotificationDeliveryPlan;
}) {
  let delivered = false;
  let attempted = false;

  if (params.plan.wantsEmail) {
    attempted = true;
    if (params.patient.email) {
      if (params.plan.html) {
        await sendEmailWithHtml(
          params.patient.email,
          params.plan.subject,
          params.plan.body,
          params.plan.html,
        );
      } else {
        await sendEmail(params.patient.email, params.plan.subject, params.plan.body);
      }
      delivered = true;
    }
  }

  if (params.plan.wantsSms) {
    attempted = true;
    if (params.patient.phone) {
      await sendSms({
        to: params.patient.phone,
        body: params.plan.body,
        patientId: params.patient.id,
      });
      delivered = true;
    }
  }

  if (params.plan.wantsWhatsApp) {
    attempted = true;
    if (params.patient.phone) {
      await sendKapsoWhatsAppText({
        to: params.patient.phone,
        body: params.plan.body,
      });
      delivered = true;
    }
  }

  return { delivered, attempted };
}

export function notificationPlanHasConfiguredChannel(plan: NotificationDeliveryPlan) {
  return plan.wantsEmail || plan.wantsSms || plan.wantsWhatsApp;
}
