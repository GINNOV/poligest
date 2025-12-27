import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RecurringMessageKind, RecurringMessageStatus } from "@prisma/client";
import { sendEmail } from "@/lib/email";
import { errorResponse } from "@/lib/error-response";
import {
  RECURRING_MESSAGE_DEFAULTS,
  applyTemplate,
  getItalianHolidays,
  normalizeBirthday,
} from "@/lib/recurring-messages";

export const runtime = "nodejs";

const MAX_SEND = 200;

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function setLocalHour(date: Date, hour: number) {
  const next = new Date(date);
  next.setHours(hour, 0, 0, 0);
  return next;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "long" }).format(date);
}

type Candidate = {
  kind: RecurringMessageKind;
  patientId: string;
  email: string;
  scheduledFor: Date;
  eventDate?: Date;
  dedupeKey: string;
  templateVars: Record<string, string>;
  subject: string;
  body: string;
};

async function getConfigs() {
  const stored = await prisma.recurringMessageConfig.findMany();
  return RECURRING_MESSAGE_DEFAULTS.map((defaults) => {
    const match = stored.find((entry) => entry.kind === defaults.kind);
    return {
      kind: defaults.kind as RecurringMessageKind,
      enabled: match?.enabled ?? true,
      subject: match?.subject ?? defaults.subject,
      body: match?.body ?? defaults.body,
      daysBefore: match?.daysBefore ?? defaults.daysBefore ?? null,
    };
  });
}

async function buildCandidates(now: Date): Promise<Candidate[]> {
  const configs = await getConfigs();
  const patients = await prisma.patient.findMany({
    where: { email: { not: null } },
    select: { id: true, email: true, firstName: true, lastName: true, birthDate: true },
  });
  const candidates: Candidate[] = [];

  const holidayConfig = configs.find((c) => c.kind === RecurringMessageKind.HOLIDAY && c.enabled);
  if (holidayConfig) {
    const holidays = getItalianHolidays(now.getFullYear());
    for (const holiday of holidays) {
      const scheduledFor = setLocalHour(holiday.date, 9);
      const isDue = now >= scheduledFor && now < addDays(scheduledFor, 1);
      if (!isDue) continue;
      for (const patient of patients) {
        const dedupeKey = `holiday:${holiday.key}:${holiday.date.getFullYear()}:${patient.id}`;
        candidates.push({
          kind: RecurringMessageKind.HOLIDAY,
          patientId: patient.id,
          email: patient.email ?? "",
          scheduledFor,
          eventDate: holiday.date,
          dedupeKey,
          templateVars: {
            firstName: patient.firstName,
            lastName: patient.lastName,
            holidayName: holiday.name,
            holidayDate: formatDate(holiday.date),
          },
          subject: holidayConfig.subject,
          body: holidayConfig.body,
        });
      }
    }
  }

  const closureConfig = configs.find((c) => c.kind === RecurringMessageKind.CLOSURE && c.enabled);
  if (closureConfig) {
    const closures = await prisma.practiceClosure.findMany({
      where: { startsAt: { gte: addDays(now, -30) } },
    });
    const daysBefore = closureConfig.daysBefore ?? 7;
    for (const closure of closures) {
      const scheduledFor = setLocalHour(addDays(new Date(closure.startsAt), -daysBefore), 9);
      if (!(now >= scheduledFor && now < closure.startsAt)) continue;
      const closureTitle = closure.title ?? "chiusura programmata";
      for (const patient of patients) {
        const dedupeKey = `closure:${closure.id}:${patient.id}`;
        candidates.push({
          kind: RecurringMessageKind.CLOSURE,
          patientId: patient.id,
          email: patient.email ?? "",
          scheduledFor,
          eventDate: closure.startsAt,
          dedupeKey,
          templateVars: {
            firstName: patient.firstName,
            lastName: patient.lastName,
            closureTitle,
            closureStart: formatDate(closure.startsAt),
            closureEnd: formatDate(closure.endsAt),
          },
          subject: closureConfig.subject,
          body: closureConfig.body,
        });
      }
    }
  }

  const birthdayConfig = configs.find((c) => c.kind === RecurringMessageKind.BIRTHDAY && c.enabled);
  if (birthdayConfig) {
    for (const patient of patients) {
      if (!patient.birthDate) continue;
      const birthdayThisYear = normalizeBirthday(patient.birthDate, now.getFullYear());
      const scheduledFor = setLocalHour(birthdayThisYear, 9);
      const isDue = now >= scheduledFor && now < addDays(scheduledFor, 1);
      if (!isDue) continue;
      const dedupeKey = `birthday:${birthdayThisYear.getFullYear()}:${patient.id}`;
      candidates.push({
        kind: RecurringMessageKind.BIRTHDAY,
        patientId: patient.id,
        email: patient.email ?? "",
        scheduledFor,
        eventDate: birthdayThisYear,
        dedupeKey,
        templateVars: {
          firstName: patient.firstName,
          lastName: patient.lastName,
          birthdayDate: formatDate(birthdayThisYear),
        },
        subject: birthdayConfig.subject,
        body: birthdayConfig.body,
      });
    }
  }

  return candidates;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return errorResponse({
      message: "Unauthorized",
      status: 401,
      source: "recurring_notifications",
      path: new URL(req.url).pathname,
    });
  }

  try {
    const now = new Date();
    const candidates = await buildCandidates(now);
    if (candidates.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    const dedupeKeys = candidates.map((candidate) => candidate.dedupeKey);
    const existing = await prisma.recurringMessageLog.findMany({
      where: { dedupeKey: { in: dedupeKeys } },
      select: { dedupeKey: true, status: true },
    });
    const existingByKey = new Map(existing.map((row) => [row.dedupeKey, row.status]));

    let processed = 0;
    for (const candidate of candidates) {
      if (processed >= MAX_SEND) break;
      const existingStatus = existingByKey.get(candidate.dedupeKey);
      if (existingStatus === RecurringMessageStatus.SENT || existingStatus === RecurringMessageStatus.SKIPPED) {
        continue;
      }

      const subject = applyTemplate(candidate.subject, candidate.templateVars);
      const body = applyTemplate(candidate.body, candidate.templateVars);

      let status: RecurringMessageStatus = RecurringMessageStatus.SENT;
      let error: string | null = null;
      let sentAt: Date | null = new Date();

      try {
        await sendEmail(candidate.email, subject, body);
      } catch (err) {
        status = RecurringMessageStatus.FAILED;
        error = err instanceof Error ? err.message : String(err);
        sentAt = null;
      }

      if (existingStatus === RecurringMessageStatus.FAILED) {
        await prisma.recurringMessageLog.update({
          where: { dedupeKey: candidate.dedupeKey },
          data: {
            status,
            error: error ?? undefined,
            sentAt: sentAt ?? undefined,
          },
        });
      } else {
        await prisma.recurringMessageLog.create({
          data: {
            kind: candidate.kind,
            patientId: candidate.patientId,
            scheduledFor: candidate.scheduledFor,
            eventDate: candidate.eventDate,
            dedupeKey: candidate.dedupeKey,
            status,
            error: error ?? undefined,
            sentAt: sentAt ?? undefined,
          },
        });
      }

      processed += 1;
    }

    return NextResponse.json({ processed });
  } catch (error) {
    return errorResponse({
      message: "Errore invio notifiche ricorrenti",
      status: 500,
      source: "recurring_notifications",
      path: new URL(req.url).pathname,
      error,
    });
  }
}
