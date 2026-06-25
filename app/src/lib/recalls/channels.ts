import { NotificationChannel } from "@prisma/client";

export const NOTIFICATION_CHANNEL_OPTIONS = [
  { value: NotificationChannel.WHATSAPP, label: "WhatsApp (Kapso)" },
  { value: NotificationChannel.SMS, label: "SMS" },
  { value: NotificationChannel.EMAIL, label: "Email" },
  { value: NotificationChannel.BOTH, label: "Email + SMS" },
] as const;

export const DEFAULT_NOTIFICATION_CHANNEL = NotificationChannel.WHATSAPP;