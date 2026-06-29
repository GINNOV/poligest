import { prisma } from "@/lib/prisma";
import { Prisma, Role } from "@prisma/client";
import { headers } from "next/headers";

export const SCANID_AUDIT_ACTOR = "scanID";

export const ERROR_REPORTED_AUDIT_ACTION = "error.reported";

export const AUDIT_EXCLUDED_ACTIONS = [ERROR_REPORTED_AUDIT_ACTION] as const;

export function auditLogVisibilityFilter(): Prisma.AuditLogWhereInput {
  return {
    action: {
      notIn: [...AUDIT_EXCLUDED_ACTIONS],
    },
  };
}

type Actor = {
  id: string;
  role: Role;
};

type AuditPayload = {
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
};

export type AuditLogActorView = {
  user?: { name: string | null; email: string | null } | null;
  role?: string | null;
  metadata?: unknown;
};

export async function resolveAppointmentSchedulers(appointmentIds: string[]) {
  if (appointmentIds.length === 0) {
    return new Map<string, string>();
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      action: "appointment.created",
      entity: "Appointment",
      entityId: { in: appointmentIds },
    },
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const schedulers = new Map<string, string>();
  for (const log of logs) {
    if (!log.entityId || schedulers.has(log.entityId)) continue;
    schedulers.set(log.entityId, formatAuditActor(log, "Non tracciato"));
  }

  return schedulers;
}

export function formatAuditActor(
  log: AuditLogActorView | null | undefined,
  fallback = "Origine non tracciata",
): string {
  if (!log) return fallback;

  const metadata = log.metadata;
  if (metadata && typeof metadata === "object" && metadata !== null && "actorLabel" in metadata) {
    const actorLabel = metadata.actorLabel;
    if (typeof actorLabel === "string" && actorLabel.trim()) {
      return actorLabel;
    }
  }

  return log.user?.name ?? log.user?.email ?? (log.role ? String(log.role) : fallback);
}

export async function logMacosScanAudit(payload: {
  action: "patient.created" | "patient.updated";
  patientId: string;
  metadata?: Record<string, Prisma.InputJsonValue>;
}) {
  await logAudit(null, {
    action: payload.action,
    entity: "Patient",
    entityId: payload.patientId,
    metadata: {
      actorLabel: SCANID_AUDIT_ACTOR,
      source: "scanID",
      ...payload.metadata,
    },
  });
}

export async function logAudit(actor: Actor | null, payload: AuditPayload) {
  let ip: string | null = null;
  try {
    const headersList = await headers();
    const forwardedFor = headersList.get("x-forwarded-for");
    if (forwardedFor) {
      ip = forwardedFor.split(",")[0].trim();
    } else {
      ip = headersList.get("x-real-ip") || null;
    }
  } catch (e) {
    // headers() can fail if called outside of a request context (e.g. build time or some background jobs)
    console.warn("logAudit: could not get headers for IP tracking", e);
  }

  await prisma.auditLog.create({
    data: {
      action: payload.action,
      entity: payload.entity,
      entityId: payload.entityId,
      metadata: payload.metadata,
      userId: actor?.id,
      role: actor?.role,
      ip: ip,
    },
  });
}
