import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/error-response";
import { sendPracticeWeeklyReport } from "@/lib/practice-weekly-report";
import { getPracticeTimeZone } from "@/lib/practice-settings";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const providedSecret = req.headers.get("x-cron-secret");
  if (!secret || providedSecret !== secret) {
    return errorResponse({
      message: "Unauthorized",
      status: 401,
      source: "weekly_report",
      path: new URL(req.url).pathname,
    });
  }

  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";
    const timeZone = await getPracticeTimeZone();
    const result = await sendPracticeWeeklyReport({ force, trigger: "API", timeZone });
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
