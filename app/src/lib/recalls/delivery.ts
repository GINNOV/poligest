import { NotificationChannel } from "@prisma/client";
import { sendEmail } from "@/lib/email";
import { sendKapsoWhatsAppText } from "@/lib/kapso-whatsapp";
import { sendSms } from "@/lib/sms";

export type NotificationDeliveryPlan = {
  wantsEmail: boolean;
  wantsSms: boolean;
  wantsWhatsApp: boolean;
  subject: string;
  body: string;
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
      await sendEmail(params.patient.email, params.plan.subject, params.plan.body);
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

export function formatNotificationChannel(channel: NotificationChannel | string | null | undefined) {
  switch (channel) {
    case NotificationChannel.WHATSAPP:
      return "WhatsApp";
    case NotificationChannel.SMS:
      return "SMS";
    case NotificationChannel.BOTH:
      return "Email + SMS";
    case NotificationChannel.EMAIL:
    default:
      return "Email";
  }
}