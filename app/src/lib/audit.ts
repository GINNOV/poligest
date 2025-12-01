import { prisma } from "@/lib/prisma";
import { Prisma, Role } from "@prisma/client";

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
  await prisma.auditLog.create({
    data: {
      action: payload.action,
      entity: payload.entity,
      entityId: payload.entityId,
      metadata: payload.metadata,
      userId: actor?.id,
      role: actor?.role,
    },
  });
}
