"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import {
  saveAutoMergeEmptyDuplicates,
  savePracticeTimeZone,
} from "@/lib/practice-settings";
import {
  DEFAULT_PRACTICE_TIME_ZONE,
  PRACTICE_SETTINGS_ID,
  PRACTICE_TIME_ZONE_STORAGE_KEY,
} from "@/lib/practice-time-zone";
import { logAudit } from "@/lib/audit";

export async function updatePracticeTimeZone(timeZone: string) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const savedTimeZone = await savePracticeTimeZone(timeZone || DEFAULT_PRACTICE_TIME_ZONE);

  await logAudit(user, {
    action: "practice.timezone_updated",
    entity: "System",
    entityId: PRACTICE_TIME_ZONE_STORAGE_KEY,
    metadata: { timeZone: savedTimeZone },
  });

  revalidatePath("/", "layout");
  revalidatePath("/richiami");
  revalidatePath("/admin/report-settimanale");

  return savedTimeZone;
}

export async function saveAutoMergeEmptyDuplicatesAction(formData: FormData) {
  const user = await requireUser([Role.ADMIN]);
  const enabled = formData.get("enabled") === "true" || formData.get("enabled") === "on";
  const saved = await saveAutoMergeEmptyDuplicates(enabled);

  await logAudit(user, {
    action: "practice.auto_merge_duplicates_updated",
    entity: "System",
    entityId: PRACTICE_SETTINGS_ID,
    metadata: { autoMergeEmptyDuplicates: saved },
  });

  revalidatePath("/pazienti/duplicati");
  return saved;
}
