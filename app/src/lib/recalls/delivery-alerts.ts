import { formatNotificationChannel } from "@/lib/recalls/channel-labels";

export type RecallDeliveryFailureAlert = {
  readonly id: string;
  readonly patientName: string;
  readonly ruleName: string;
  readonly channelLabel: string;
  readonly dueAt: Date;
  readonly lastContactAt: Date | null;
};

export function formatRecallDeliveryFailureTitle(alert: RecallDeliveryFailureAlert) {
  return `Invio automatico non riuscito per ${alert.patientName}`;
}

export function formatRecallDeliveryFailureDetail(alert: RecallDeliveryFailureAlert) {
  const dueDate = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(alert.dueAt);
  return `${alert.ruleName} · ${alert.channelLabel} · richiamo del ${dueDate}`;
}

export function buildRecallDeliveryFailureAlert(input: {
  readonly id: string;
  readonly dueAt: Date;
  readonly lastContactAt: Date | null;
  readonly patient: { readonly firstName: string | null; readonly lastName: string | null };
  readonly rule: { readonly name: string; readonly channel: string | null };
}): RecallDeliveryFailureAlert {
  const patientName =
    `${input.patient.lastName ?? ""} ${input.patient.firstName ?? ""}`.trim() || "paziente";

  return {
    id: input.id,
    patientName,
    ruleName: input.rule.name,
    channelLabel: formatNotificationChannel(input.rule.channel),
    dueAt: input.dueAt,
    lastContactAt: input.lastContactAt,
  };
}
