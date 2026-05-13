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
});
