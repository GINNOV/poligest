import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/error-response";
import { sendPracticeWeeklyReport } from "@/lib/practice-weekly-report";
import { getPracticeTimeZone } from "@/lib/practice-settings";
import { unauthorizedCronResponse, validateCronSecret } from "@/lib/cron-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const isAuthorized = await validateCronSecret(req);
  if (!isAuthorized) {
    return unauthorizedCronResponse(req, "weekly_report");
  }

  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";
    const timeZone = await getPracticeTimeZone();
    const result = await sendPracticeWeeklyReport({ force, trigger: "CRON", timeZone });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse({
      message: "Errore invio report settimanale",
      status: 500,
      source: "weekly_report",
      path: new URL(req.url).pathname,
      error,
    });
  }
}
