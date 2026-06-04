import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    appointment: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    patient: {
      findMany: vi.fn(),
    },
    doctor: {
      findMany: vi.fn(),
    },
    smsTemplate: {
      findUnique: vi.fn(),
    },
    auditLog: {
      groupBy: vi.fn(),
    },
  };
  const getOptionalPrismaModel = vi.fn();

  return { prisma, getOptionalPrismaModel };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/prisma-models", () => ({
  getOptionalPrismaModel: mocks.getOptionalPrismaModel,
}));

import { getAgendaPageData } from "@/lib/appointments/agenda";

describe("getAgendaPageData", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getOptionalPrismaModel.mockReturnValue(undefined);
    mocks.prisma.appointment.findMany.mockResolvedValue([]);
    mocks.prisma.appointment.count.mockResolvedValue(0);
    mocks.prisma.patient.findMany.mockResolvedValue([]);
    mocks.prisma.doctor.findMany.mockResolvedValue([]);
    mocks.prisma.smsTemplate.findUnique.mockResolvedValue(null);
    mocks.prisma.auditLog.groupBy.mockResolvedValue([]);
  });

  it("filters appointments by doctor name independently from the free-text search", async () => {
    await getAgendaPageData({
      dateValue: "2026-05-13",
      doctorName: "  Monica  ",
      searchValue: "igiene",
    });

    expect(mocks.prisma.appointment.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            {
              doctor: {
                fullName: {
                  contains: "monica",
                  mode: "insensitive",
                },
              },
            },
          ]),
          OR: expect.any(Array),
        }),
      }),
    );
    expect(mocks.prisma.appointment.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          expect.objectContaining({
            doctor: expect.objectContaining({
              fullName: expect.objectContaining({ contains: "monica" }),
            }),
          }),
        ]),
      }),
    });
  });

  it("marks appointments with persisted WhatsApp reminder sends", async () => {
    const appointments = [
      {
        id: "appt-1",
        startsAt: new Date("2026-05-13T09:00:00.000Z"),
        endsAt: new Date("2026-05-13T10:00:00.000Z"),
        patient: { firstName: "Ada", lastName: "Rossi", phone: "+3900000001" },
        doctor: { fullName: "Dr. Verde", specialty: "Odontoiatria" },
      },
      {
        id: "appt-2",
        startsAt: new Date("2026-05-13T11:00:00.000Z"),
        endsAt: new Date("2026-05-13T12:00:00.000Z"),
        patient: { firstName: "Bruno", lastName: "Bianchi", phone: "+3900000002" },
        doctor: { fullName: "Dr. Verde", specialty: "Odontoiatria" },
      },
    ];
    mocks.prisma.appointment.findMany
      .mockResolvedValueOnce(appointments)
      .mockResolvedValueOnce(appointments.map((appointment) => ({ patient: appointment.patient })));
    mocks.prisma.auditLog.groupBy.mockResolvedValue([
      { entityId: "appt-1", _count: { _all: 2 } },
    ]);

    const result = await getAgendaPageData({
      dateValue: "2026-05-13",
      searchValue: "",
    });

    expect(result.appointments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "appt-1", reminderSent: true, reminderSendCount: 2 }),
        expect.objectContaining({ id: "appt-2", reminderSent: false, reminderSendCount: 0 }),
      ]),
    );
  });
});
