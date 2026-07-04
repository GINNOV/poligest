"use server";

import { ASSISTANT_ROLE } from "@/lib/roles";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import {
  parseAppointmentReminderRulePayload,
  parseCreateRecallRulePayload,
  parseRecurringMessagePayload,
  parseScheduledRecallPayload,
  parseUpdateRecallRulePayload,
} from "@/lib/recalls/payload";
import {
  createRecallRuleRecord,
  createScheduledRecallRecord,
  deleteRecallRuleRecord,
  deleteScheduledRecallRecord,
  upsertAppointmentReminderRuleRecord,
  updateRecallRuleRecord,
  upsertRecurringMessageConfigRecord,
} from "@/lib/recalls/persistence";
import { revalidateRichiami } from "@/lib/recalls/side-effects";

export async function createRecallRule(formData: FormData) {
  await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  const payload = parseCreateRecallRulePayload(formData);
  await createRecallRuleRecord(payload);
  revalidateRichiami();
}

export async function updateAppointmentReminderRule(formData: FormData) {
  await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
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
  await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  const ruleId = formData.get("ruleId") as string;
  if (!ruleId) throw new Error("Regola non valida");

  await deleteRecallRuleRecord(ruleId);
  revalidateRichiami();
}

export async function updateRecurringConfig(formData: FormData) {
  await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  const payload = parseRecurringMessagePayload(formData);
  await upsertRecurringMessageConfigRecord(payload);
  revalidateRichiami();
}

export async function updateRecallRule(formData: FormData) {
  await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
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