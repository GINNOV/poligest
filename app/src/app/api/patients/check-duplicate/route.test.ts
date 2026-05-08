import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const requireUser = vi.fn();
  const prisma = {
    patient: {
      findFirst: vi.fn(),
    },
  };

  return {
    requireUser,
    prisma,
  };
});

vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { GET } from "@/app/api/patients/check-duplicate/route";

describe("GET /api/patients/check-duplicate", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireUser.mockResolvedValue({ id: "staff-1", role: "ADMIN" });
    mocks.prisma.patient.findFirst.mockResolvedValue(null);
  });

  it("checks duplicate patients by normalized phone when birth date is missing", async () => {
    mocks.prisma.patient.findFirst.mockResolvedValue({
      id: "patient-1",
      firstName: "Mario",
      lastName: "Rossi",
      phone: "+393331234567",
      birthDate: null,
    });

    const response = await GET(
      new Request("http://localhost/api/patients/check-duplicate?firstName=mario&lastName=rossi&phone=3331234567"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      exists: true,
      patient: {
        id: "patient-1",
        firstName: "Mario",
        lastName: "Rossi",
        phone: "+393331234567",
        birthDate: null,
      },
    });
    expect(mocks.prisma.patient.findFirst).toHaveBeenCalledWith({
      where: {
        AND: [
          { firstName: { equals: "Mario", mode: "insensitive" } },
          { lastName: { equals: "Rossi", mode: "insensitive" } },
          {
            OR: [
              { phone: { equals: "+393331234567" } },
            ],
          },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        birthDate: true,
      },
    });
  });
});
