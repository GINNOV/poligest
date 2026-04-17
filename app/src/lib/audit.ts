import { prisma } from "@/lib/prisma";
import { Prisma, Role } from "@prisma/client";
import { headers } from "next/headers";

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
