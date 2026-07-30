import { NextResponse } from "next/server";
import { unauthorizedCronResponse, validateCronSecret } from "@/lib/cron-auth";
import { errorResponse } from "@/lib/error-response";
import { mergeAllSafeEmptyShellGroups } from "@/lib/patients/duplicate-merge";
import { getAutoMergeEmptyDuplicates } from "@/lib/practice-settings";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const isAuthorized = await validateCronSecret(req);
  if (!isAuthorized) {
    return unauthorizedCronResponse(req, "patient_duplicates_auto_merge");
  }

  try {
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
  } catch (error) {
    return errorResponse({
      message: "Errore auto-merge duplicati pazienti",
      status: 500,
      source: "patient_duplicates_auto_merge",
      path: new URL(req.url).pathname,
      error,
    });
  }
}
