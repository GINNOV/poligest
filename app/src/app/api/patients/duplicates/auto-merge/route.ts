import { NextResponse } from "next/server";
import { unauthorizedCronResponse, validateCronSecret } from "@/lib/cron-auth";
import { getAutoMergeEmptyDuplicates } from "@/lib/practice-settings";
import { mergeAllSafeEmptyShellGroups } from "@/lib/patients/duplicate-merge";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!(await validateCronSecret(req))) {
    return unauthorizedCronResponse(req, "patient_duplicates_auto_merge");
  }

  const enabled = await getAutoMergeEmptyDuplicates();
  if (!enabled) {
    return NextResponse.json({ ok: true, skipped: true, reason: "setting_disabled" });
  }

  const result = await mergeAllSafeEmptyShellGroups({
    actor: null,
    trigger: "cron",
    autoEligibleOnly: true,
  });

  return NextResponse.json({ ok: true, ...result });
}
