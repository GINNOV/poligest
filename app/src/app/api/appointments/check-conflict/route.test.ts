import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  errorResponse: vi.fn(async ({ message, status = 500 }: { message: string; status?: number }) =>
    Response.json({ error: message, code: "ERR_CONFLICT" }, { status })),
  prisma: {
    appointment: {
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/error-response", () => ({
  errorResponse: mocks.errorResponse,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { AppointmentStatus } from "@prisma/client";
import { GET } from "@/app/api/appointments/check-conflict/route";

describe("GET /api/appointments/check-conflict", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1", role: "ADMIN" });
    mocks.prisma.appointment.count.mockResolvedValue(2);
  });

  it("returns a non-conflict response when required params are missing or invalid", async () => {
    const missing = await GET(new Request("http://localhost/api/appointments/check-conflict"));
    expect(await missing.json()).toEqual({ conflict: false, message: "Dati insufficienti" });

    const invalid = await GET(
      new Request(
        "http://localhost/api/appointments/check-conflict?doctorId=doc-1&startsAt=bad&endsAt=also-bad",
      ),
    );
    expect(await invalid.json()).toEqual({ conflict: false, message: "Formato data non valido" });
    expect(mocks.prisma.appointment.count).not.toHaveBeenCalled();
  });

  it("counts overlapping appointments and reports conflicts", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/appointments/check-conflict?doctorId=doc-1&startsAt=2026-04-08T10:00:00.000Z&endsAt=2026-04-08T10:30:00.000Z&excludeId=appt-1",
      ),
    );

    expect(mocks.prisma.appointment.count).toHaveBeenCalledWith({
      where: {
        status: { not: AppointmentStatus.CANCELLED },
        doctorId: "doc-1",
        id: { not: "appt-1" },
        startsAt: { lt: new Date("2026-04-08T10:30:00.000Z") },
        endsAt: { gt: new Date("2026-04-08T10:00:00.000Z") },
      },
    });
    expect(await response.json()).toEqual({ conflict: true, count: 2 });
  });

  it("returns a structured error response when the count query fails", async () => {
    mocks.prisma.appointment.count.mockRejectedValue(new Error("db down"));

    const response = await GET(
      new Request(
        "http://localhost/api/appointments/check-conflict?doctorId=doc-1&startsAt=2026-04-08T10:00:00.000Z&endsAt=2026-04-08T10:30:00.000Z",
      ),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Errore controllo conflitti", code: "ERR_CONFLICT" });
  });
});
