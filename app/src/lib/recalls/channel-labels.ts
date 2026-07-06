import { NotificationChannel } from "@prisma/client";

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
