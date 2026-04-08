import { AppointmentStatus, type Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const AUTO_COMPLETE_SOURCE_STATUSES = [
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_WAITING,
  AppointmentStatus.IN_PROGRESS,
] as const;

type AppointmentUpdateClient = {
  updateMany: (args: {
    where: Prisma.AppointmentWhereInput;
    data: Prisma.AppointmentUpdateManyMutationInput;
  }) => Promise<{ count: number }>;
};

type AuditLogger = typeof logAudit;

export async function autoCompletePastAppointments(
  now = new Date(),
  deps?: {
    appointmentClient?: AppointmentUpdateClient;
    auditLogger?: AuditLogger;
  },
) {
  const appointmentClient = deps?.appointmentClient ?? prisma.appointment;
  const auditLogger = deps?.auditLogger ?? logAudit;

  const result = await appointmentClient.updateMany({
    where: {
      status: { in: [...AUTO_COMPLETE_SOURCE_STATUSES] },
      endsAt: { lte: now },
    },
    data: {
      status: AppointmentStatus.COMPLETED,
    },
  });

  if (result.count > 0) {
    await auditLogger(null, {
      action: "appointment.auto_completed",
      entity: "System",
      metadata: {
        count: result.count,
        completedAt: now.toISOString(),
        fromStatuses: [...AUTO_COMPLETE_SOURCE_STATUSES],
      },
    });
  }

  return result.count;
}

export { AUTO_COMPLETE_SOURCE_STATUSES };
