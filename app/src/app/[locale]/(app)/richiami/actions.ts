"use server";

import { redirect } from "next/navigation";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import {
  parseAppointmentReminderRulePayload,
  parseCreateRecallRulePayload,
  parseManualNotificationPayload,
  parseRecurringMessagePayload,
  parseScheduledRecallPayload,
  parseUpdateRecallRulePayload,
} from "@/lib/recalls/payload";
import {
  createRecallRuleRecord,
  createScheduledRecallRecord,
  deleteRecallRuleRecord,
  deleteScheduledRecallRecord,
  buildManualNotificationContext as loadManualNotificationContext,
  buildManualNotificationMessage as formatManualNotificationMessage,
  upsertAppointmentReminderRuleRecord,
  updateRecallRuleRecord,
  upsertRecurringMessageConfigRecord,
} from "@/lib/recalls/persistence";
import { deliverManualNotification, revalidateRichiami } from "@/lib/recalls/side-effects";

function isNextRedirectError(err: unknown): err is { digest: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export async function createRecallRule(formData: FormData) {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const payload = parseCreateRecallRulePayload(formData);
  await createRecallRuleRecord(payload);
  revalidateRichiami();
}

export async function updateAppointmentReminderRule(formData: FormData) {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const payload = parseAppointmentReminderRulePayload(formData);
  await upsertAppointmentReminderRuleRecord(payload);
  revalidateRichiami();
}

export async function scheduleRecall(formData: FormData) {
  await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  const payload = parseScheduledRecallPayload(formData);
  await createScheduledRecallRecord(payload);
  revalidateRichiami();
}

export async function deleteRecallRule(formData: FormData) {
  await requireUser([Role.ADMIN]);
  const ruleId = formData.get("ruleId") as string;
  if (!ruleId) throw new Error("Regola non valida");

  await deleteRecallRuleRecord(ruleId);
  revalidateRichiami();
}

export async function updateRecurringConfig(formData: FormData) {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const payload = parseRecurringMessagePayload(formData);
  await upsertRecurringMessageConfigRecord(payload);
  revalidateRichiami();
}

export async function updateRecallRule(formData: FormData) {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const payload = parseUpdateRecallRulePayload(formData);
  await updateRecallRuleRecord(payload);
  revalidateRichiami();
}

export async function deleteScheduledRecall(formData: FormData) {
  await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  const recallId = formData.get("recallId") as string;
  if (!recallId) throw new Error("Richiamo non valido");

  await deleteScheduledRecallRecord(recallId);
  revalidateRichiami();
}

export async function sendManualNotification(formData: FormData) {
  try {
    const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
    const payload = parseManualNotificationPayload(formData);
    const recipient = await loadManualNotificationContext(payload);
    const message = formatManualNotificationMessage({
      patientFirstName: recipient.patient.firstName,
      patientLastName: recipient.patient.lastName,
      eventLabel: recipient.eventLabel,
      eventDate: recipient.eventDate,
      message: recipient.message,
    });

    await deliverManualNotification({
      user,
      patient: recipient.patient,
      channel: payload.channel,
      message,
      emailSubject: recipient.emailSubject,
      notificationType: payload.notificationType,
    });

    revalidateRichiami();
    redirect(`${payload.returnTo}?manualSuccess=${encodeURIComponent("Notifica inviata con successo.")}`);
  } catch (err: unknown) {
    if (isNextRedirectError(err)) throw err;
    const message =
      typeof (err as { message?: unknown })?.message === "string"
        ? ((err as { message: string }).message ?? "")
        : "Impossibile inviare la notifica.";
    const returnTo = (formData.get("returnTo") as string) || "/richiami/manuale";
    redirect(`${returnTo}?manualError=${encodeURIComponent(message)}`);
  }
}
