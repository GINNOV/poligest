import { describe, expect, it, vi } from "vitest";
import { AppointmentStatus } from "@prisma/client";
import { AUTO_COMPLETE_SOURCE_STATUSES, autoCompletePastAppointments } from "@/lib/appointments/status-automation";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    appointment: {
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
}));

describe("status-automation", () => {
  it("auto-completes past active appointments and writes one audit log", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 3 });
    const auditLogger = vi.fn().mockResolvedValue(undefined);
    const now = new Date("2026-04-08T12:00:00.000Z");

    const count = await autoCompletePastAppointments(now, {
      appointmentClient: { updateMany },
      auditLogger,
    });

    expect(count).toBe(3);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        status: { in: [...AUTO_COMPLETE_SOURCE_STATUSES] },
        endsAt: { lte: now },
      },
      data: {
        status: AppointmentStatus.COMPLETED,
      },
    });
    expect(auditLogger).toHaveBeenCalledWith(null, {
      action: "appointment.auto_completed",
      entity: "System",
      metadata: {
        count: 3,
        completedAt: now.toISOString(),
        fromStatuses: [...AUTO_COMPLETE_SOURCE_STATUSES],
      },
    });
  });

  it("does not write an audit log when no appointments were updated", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const auditLogger = vi.fn().mockResolvedValue(undefined);

    const count = await autoCompletePastAppointments(new Date("2026-04-08T12:00:00.000Z"), {
      appointmentClient: { updateMany },
      auditLogger,
    });

    expect(count).toBe(0);
    expect(auditLogger).not.toHaveBeenCalled();
  });
});
