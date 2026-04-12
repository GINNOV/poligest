"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { savePracticeTimeZone } from "@/lib/practice-settings";
import {
  DEFAULT_PRACTICE_TIME_ZONE,
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
