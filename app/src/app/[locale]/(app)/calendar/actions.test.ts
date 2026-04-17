import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppointmentStatus, Role } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  logAudit: vi.fn(),
  redirect: vi.fn((url: string) => {
    const err = new Error("NEXT_REDIRECT");
    (err as any).digest = `NEXT_REDIRECT;${url}`;
    throw err;
  }),
  prisma: {
    appointment: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
    patient: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    appointmentReminder: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mocks.logAudit,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

// We need to export the actions from the page.tsx or a separate file.
// Since they are currently in page.tsx, we'll try to import them from there.
// Note: importing from a page file with "use server" might be tricky in tests.
import { createAppointment, updateAppointment, deleteAppointment } from "./actions";

describe("calendar actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1", role: Role.ADMIN });
    
    mocks.prisma.$transaction.mockImplementation(async (callback) => {
      if (typeof callback === "function") {
        return callback(mocks.prisma);
      }
      return callback; // Array of promises
    });
  });

  describe("createAppointment", () => {
    it("creates a new appointment and redirects to returnTo", async () => {
      const formData = new FormData();
      formData.set("title", "Visita");
      formData.set("serviceType", "Igiene");
      formData.set("startsAt", "2026-04-16T10:00");
      formData.set("endsAt", "2026-04-16T11:00");
      formData.set("patientId", "patient-1");
      formData.set("returnTo", "/calendar?view=week");

      mocks.prisma.patient.findUnique.mockResolvedValue({ id: "patient-1", email: "test@example.com" });
      mocks.prisma.appointment.create.mockResolvedValue({ id: "appt-1" });

      try {
        await createAppointment(formData);
      } catch (err: any) {
        expect(err.digest).toContain("/calendar?view=week");
      }

      expect(mocks.prisma.appointment.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          title: "Visita",
          patientId: "patient-1",
        })
      }));
      expect(mocks.logAudit).toHaveBeenCalled();
    });

    it("redirects with error if required fields are missing", async () => {
      const formData = new FormData();
      formData.set("returnTo", "/calendar");

      try {
        await createAppointment(formData);
      } catch (err: any) {
        expect(err.digest).toContain("error=");
      }
      expect(mocks.prisma.appointment.create).not.toHaveReturned();
    });
  });

  describe("updateAppointment", () => {
    it("updates an existing appointment", async () => {
      const formData = new FormData();
      formData.set("appointmentId", "appt-1");
      formData.set("title", "Updated Visita");
      formData.set("serviceType", "Chirurgia");
      formData.set("startsAt", "2026-04-16T10:00");
      formData.set("endsAt", "2026-04-16T11:00");
      formData.set("patientId", "patient-1");
      formData.set("status", AppointmentStatus.CONFIRMED);
      formData.set("returnTo", "/calendar");

      mocks.prisma.appointment.findUnique.mockResolvedValue({
        id: "appt-1",
        status: AppointmentStatus.CONFIRMED,
        startsAt: new Date("2026-04-16T10:00"),
        endsAt: new Date("2026-04-16T11:00"),
        doctorId: "doc-1"
      });

      try {
        await updateAppointment(formData);
      } catch (err: any) {
        expect(err.digest).toBe("NEXT_REDIRECT;/calendar");
      }

      expect(mocks.prisma.appointment.update).toHaveBeenCalled();
    });

    it("prevents non-admin from updating COMPLETED appointments", async () => {
      mocks.requireUser.mockResolvedValue({ id: "user-2", role: Role.MANAGER });
      mocks.prisma.appointment.findUnique.mockResolvedValue({
        id: "appt-1",
        status: AppointmentStatus.COMPLETED
      });

      const formData = new FormData();
      formData.set("appointmentId", "appt-1");
      formData.set("title", "Test");
      formData.set("serviceType", "Test");
      formData.set("startsAt", "2026-04-16T10:00");
      formData.set("endsAt", "2026-04-16T11:00");
      formData.set("patientId", "p1");
      formData.set("status", AppointmentStatus.COMPLETED);
      formData.set("returnTo", "/calendar");

      try {
        await updateAppointment(formData);
      } catch (err: any) {
        expect(decodeURIComponent(err.digest)).toContain("Solo l'admin può modificare");
      }
    });
  });

  describe("deleteAppointment", () => {
    it("deletes appointment and reminders then redirects", async () => {
      const formData = new FormData();
      formData.set("appointmentId", "appt-1");
      formData.set("returnTo", "/calendar");

      try {
        await deleteAppointment(formData);
      } catch (err: any) {
        expect(err.digest).toBe("NEXT_REDIRECT;/calendar");
      }

      expect(mocks.prisma.appointment.delete).toHaveBeenCalledWith({ where: { id: "appt-1" } });
      expect(mocks.prisma.appointmentReminder.deleteMany).toHaveBeenCalledWith({ where: { appointmentId: "appt-1" } });
    });
  });
});
