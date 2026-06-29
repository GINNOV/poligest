import { NotificationChannel } from "@prisma/client";
import { sendEmail, sendEmailWithHtml } from "@/lib/email";
import { sendKapsoWhatsAppText } from "@/lib/kapso-whatsapp";
import { sendSms } from "@/lib/sms";

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

export type NotificationChannelLabel = {
  key: "whatsapp" | "email" | "sms";
  label: string;
};

export function getNotificationChannelLabels(
  channel: NotificationChannel | string | null | undefined,
): NotificationChannelLabel[] {
  const normalized = (channel as NotificationChannel) ?? NotificationChannel.WHATSAPP;
  const labels: NotificationChannelLabel[] = [];

  if (normalized === NotificationChannel.WHATSAPP) {
    labels.push({ key: "whatsapp", label: "WhatsApp" });
  }
  if (normalized === NotificationChannel.EMAIL || normalized === NotificationChannel.BOTH) {
    labels.push({ key: "email", label: "Email" });
  }
  if (normalized === NotificationChannel.SMS || normalized === NotificationChannel.BOTH) {
    labels.push({ key: "sms", label: "SMS" });
  }

  return labels;
}

export function formatNotificationChannel(channel: NotificationChannel | string | null | undefined) {
  const labels = getNotificationChannelLabels(channel);
  if (labels.length === 0) return "Email";
  return labels.map((entry) => entry.label).join(" + ");
}