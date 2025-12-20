import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RecallStatus } from "@prisma/client";
import { sendSms } from "@/lib/sms";
import { sendEmail } from "@/lib/email";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const dueRecalls = await prisma.recall.findMany({
    where: { status: RecallStatus.PENDING, dueAt: { lte: now } },
    include: {
      patient: { select: { email: true, phone: true, firstName: true, lastName: true } },
      rule: true,
    },
    take: 50,
  });

  for (const recall of dueRecalls) {
    const patient = recall.patient;
    const rule = recall.rule as any;
    const subject = rule?.emailSubject ?? `Promemoria ${rule?.serviceType ?? ""}`;
    const body =
      rule?.message ??
      `Gentile ${patient.firstName ?? patient.lastName ?? "paziente"}, promemoria per ${rule.serviceType}.`;

    const channel = rule?.channel ?? "EMAIL";
    const wantsEmail = channel === "EMAIL" || channel === "BOTH";
    const wantsSms = channel === "SMS" || channel === "BOTH";

    let delivered = false;
    let attempted = false;

    if (wantsEmail) {
      attempted = true;
      if (patient.email) {
        try {
          await sendEmail(patient.email, subject, body);
          delivered = true;
        } catch (err) {
          console.error("[recalls] email failed", { recallId: recall.id, err });
        }
      }
    }

    if (wantsSms) {
      attempted = true;
      if (patient.phone) {
        try {
          await sendSms({
            to: patient.phone,
            body,
            patientId: recall.patientId,
          });
          delivered = true;
        } catch (err) {
          console.error("[recalls] sms failed", { recallId: recall.id, err });
        }
      }
    }

    if (attempted) {
      await prisma.recall.update({
        where: { id: recall.id },
        data: {
          status: delivered ? RecallStatus.CONTACTED : RecallStatus.SKIPPED,
          lastContactAt: new Date(),
        },
      });
    }
  }

  return NextResponse.json({ processed: dueRecalls.length });
}
