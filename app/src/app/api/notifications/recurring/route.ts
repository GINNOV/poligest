import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RecurringMessageStatus, Role } from "@prisma/client";
import { sendEmail } from "@/lib/email";
import { errorResponse } from "@/lib/error-response";
import {
  buildAdminBackupReminderCandidates,
  buildRecurringCandidates,
  filterRecurringCandidates,
  getAdminBackupReminderMonthKey,
  materializeRecurringDelivery,
  mergeRecurringConfigs,
  type RecurringCandidate,
} from "@/lib/recurring-messages/domain";
import { logAudit } from "@/lib/audit";
import { getPracticeTimeZone } from "@/lib/practice-settings";

export const runtime = "nodejs";

const MAX_SEND = 200;

function normalizeSiteOrigin(rawOrigin: string | undefined) {
  if (!rawOrigin) return "";
  if (/^https?:\/\//.test(rawOrigin)) return rawOrigin.replace(/\/$/, "");
  return `https://${rawOrigin.replace(/\/$/, "")}`;
}

function resolveSiteOrigin() {
  return normalizeSiteOrigin(
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.VERCEL_URL,
  );
}

async function getConfigs() {
  const stored = await prisma.recurringMessageConfig.findMany();
  return mergeRecurringConfigs(stored);
}

async function buildCandidates(now: Date, timeZone: string): Promise<RecurringCandidate[]> {
  const configs = await getConfigs();
  const patients = await prisma.patient.findMany({
    where: { email: { not: null } },
    select: { id: true, email: true, firstName: true, lastName: true, birthDate: true },
  });
  const closureWindowStart = new Date(now);
  closureWindowStart.setUTCDate(closureWindowStart.getUTCDate() - 30);
  const closures = await prisma.practiceClosure.findMany({
    where: { startsAt: { gte: closureWindowStart } },
  });

  return buildRecurringCandidates({
    now,
    timeZone,
    configs,
    patients: patients.map((patient) => ({
      id: patient.id,
      email: patient.email ?? "",
      firstName: patient.firstName,
      lastName: patient.lastName,
      birthDate: patient.birthDate,
    })),
    closures: closures.map((closure) => ({
      id: closure.id,
      title: closure.title,
      startsAt: closure.startsAt,
      endsAt: closure.endsAt,
    })),
  });
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const providedSecret = req.headers.get("x-cron-secret");
  if (!secret || providedSecret !== secret) {
    return errorResponse({
      message: "Unauthorized",
      status: 401,
      source: "recurring_notifications",
      path: new URL(req.url).pathname,
    });
  }

  try {
    const now = new Date();
    const timeZone = await getPracticeTimeZone();
    const candidates = await buildCandidates(now, timeZone);
    const siteOrigin = resolveSiteOrigin();
    const adminResetUrl = siteOrigin ? `${siteOrigin}/admin/reset` : "/admin/reset";
    const monthKey = getAdminBackupReminderMonthKey(now);
    const [adminsRaw, existingAdminReminderLogs] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: Role.ADMIN,
          isActive: true,
        },
        select: { id: true, email: true, name: true },
      }),
      prisma.auditLog.findMany({
        where: {
          action: "admin.backup_reminder_sent",
          entity: "System",
          entityId: { endsWith: `:${monthKey}` },
        },
        select: { entityId: true },
      }),
    ]);
    const admins = adminsRaw.filter(
      (admin): admin is { id: string; email: string; name: string | null } =>
        typeof admin.email === "string" && admin.email.trim().length > 0,
    );

    const adminBackupCandidates = buildAdminBackupReminderCandidates({
      now,
      timeZone,
      admins: admins.map((admin) => ({
        id: admin.id,
        email: admin.email ?? "",
        name: admin.name,
      })),
      existingAuditEntityIds: new Set(
        existingAdminReminderLogs
          .map((log) => log.entityId)
          .filter((entityId): entityId is string => Boolean(entityId)),
      ),
      adminResetUrl,
    });

    if (candidates.length === 0) {
      if (adminBackupCandidates.length === 0) {
        return NextResponse.json({ processed: 0, adminBackupReminders: 0 });
      }
    }

    const dedupeKeys = candidates.map((candidate) => candidate.dedupeKey);
    const existing = await prisma.recurringMessageLog.findMany({
      where: { dedupeKey: { in: dedupeKeys } },
      select: { dedupeKey: true, status: true },
    });
    const existingByKey = new Map(existing.map((row) => [row.dedupeKey, row.status]));

    const selectedCandidates = filterRecurringCandidates({
      candidates,
      existingStatuses: existingByKey,
      maxSend: MAX_SEND,
    });

    let processed = 0;
    for (const candidate of selectedCandidates) {
      const existingStatus = existingByKey.get(candidate.dedupeKey);

      let status: RecurringMessageStatus = RecurringMessageStatus.SENT;
      let error: string | null = null;
      let sentAt: Date | null = new Date();

      try {
        const delivery = materializeRecurringDelivery(candidate);
        await sendEmail(candidate.email, delivery.subject, delivery.body);
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

    let adminBackupProcessed = 0;
    for (const candidate of adminBackupCandidates) {
      try {
        await sendEmail(candidate.email, candidate.subject, candidate.body);
        await logAudit(null, {
          action: "admin.backup_reminder_sent",
          entity: "System",
          entityId: candidate.auditEntityId,
          metadata: {
            monthKey: candidate.monthKey,
            email: candidate.email,
          },
        });
        adminBackupProcessed += 1;
      } catch (err) {
        console.error("[admin_backup_reminder] email failed", {
          userId: candidate.userId,
          err,
        });
      }
    }

    return NextResponse.json({ processed, adminBackupReminders: adminBackupProcessed });
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
