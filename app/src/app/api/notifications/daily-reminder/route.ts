import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/error-response";
import { sendDailyReminders } from "@/lib/daily-reminder";
import { getPracticeTimeZone } from "@/lib/practice-settings";
import { unauthorizedCronResponse, validateCronSecret } from "@/lib/cron-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const isAuthorized = await validateCronSecret(req);
  if (!isAuthorized) {
    return unauthorizedCronResponse(req, "daily_reminder");
  }

  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";
    const timeZone = await getPracticeTimeZone();
    const result = await sendDailyReminders({ force, trigger: "API", timeZone });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse({
      message: "Errore invio promemoria quotidiano",
      status: 500,
      source: "daily_reminder",
      path: new URL(req.url).pathname,
      error,
    });
  }
}
