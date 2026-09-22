import { getNotificationChannelLabels, formatNotificationChannel } from "@/lib/recalls/channel-labels";

export type RecallDeliveryFailureAlert = {
  readonly id: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly ruleName: string;
  readonly channelLabel: string;
  readonly dueAt: Date;
  readonly lastContactAt: Date | null;
  readonly contactGap: string | null;
};

export function formatFailedDeliverySummary(count: number) {
  if (count === 1) return "1 invio non riuscito";
  return `${count} invii non riusciti`;
}

export function formatRecallDeliveryFailureTitle(alert: RecallDeliveryFailureAlert) {
  return `Invio automatico non riuscito per ${alert.patientName}`;
}

export function formatRecallDeliveryFailureDetail(alert: RecallDeliveryFailureAlert) {
  const dueDate = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(alert.dueAt);
  return `${alert.ruleName} · ${alert.channelLabel} · richiamo del ${dueDate}`;
}

export function describeMissingRecallContact(input: {
  readonly channel: string | null;
  readonly phone: string | null;
  readonly email: string | null;
}) {
  const labels = getNotificationChannelLabels(input.channel);
  const needsPhone = labels.some((label) => label.key === "whatsapp" || label.key === "sms");
  const needsEmail = labels.some((label) => label.key === "email");
  const phoneMissing = needsPhone && !input.phone?.trim();
  const emailMissing = needsEmail && !input.email?.trim();

  if (phoneMissing && emailMissing) return "Mancano il telefono e l'email.";
  if (phoneMissing) return "Manca il numero di telefono.";
  if (emailMissing) return "Manca l'indirizzo email.";
  return null;
}

export function buildRecallDeliveryFailureAlert(input: {
  readonly id: string;
  readonly dueAt: Date;
  readonly lastContactAt: Date | null;
  readonly patient: {
    readonly id: string;
    readonly firstName: string | null;
    readonly lastName: string | null;
    readonly phone: string | null;
    readonly email: string | null;
  };
  readonly rule: { readonly name: string; readonly channel: string | null };
}): RecallDeliveryFailureAlert {
  const patientName =
    `${input.patient.lastName ?? ""} ${input.patient.firstName ?? ""}`.trim() || "paziente";

  return {
    id: input.id,
    patientId: input.patient.id,
    patientName,
    ruleName: input.rule.name,
    channelLabel: formatNotificationChannel(input.rule.channel),
    dueAt: input.dueAt,
    lastContactAt: input.lastContactAt,
    contactGap: describeMissingRecallContact({
      channel: input.rule.channel,
      phone: input.patient.phone,
      email: input.patient.email,
    }),
  };
}
