import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => {
  const requireUser = vi.fn();
  const prisma = {
    appointment: {
      findMany: vi.fn(),
    },
  };
  const availabilityClient = {
    findMany: vi.fn(),
  };
  const closureClient = {
    findMany: vi.fn(),
  };
  const weeklyClosureClient = {
    findMany: vi.fn(),
  };
  const timeOffClient = {
    findMany: vi.fn(),
  };

  return {
    requireUser,
    prisma,
    availabilityClient,
    closureClient,
    weeklyClosureClient,
    timeOffClient,
  };
});

vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/prisma-models", () => ({
  getOptionalPrismaModel: (name: string) => {
    if (name === "doctorAvailabilityWindow") return mocks.availabilityClient;
    if (name === "practiceClosure") return mocks.closureClient;
    if (name === "practiceWeeklyClosure") return mocks.weeklyClosureClient;
    if (name === "doctorTimeOff") return mocks.timeOffClient;
    return null;
  },
}));

describe("GET /api/appointments/alternative-slots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "staff-1" });
    mocks.prisma.appointment.findMany.mockResolvedValue([]);
    mocks.availabilityClient.findMany.mockResolvedValue([
      { doctorId: "doc-1", dayOfWeek: 3, startMinute: 9 * 60, endMinute: 13 * 60 },
    ]);
    mocks.closureClient.findMany.mockResolvedValue([]);
    mocks.weeklyClosureClient.findMany.mockResolvedValue([]);
    mocks.timeOffClient.findMany.mockResolvedValue([]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T08:00:00.000Z"));
  });

  it("returns alternative slots for a valid search", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/appointments/alternative-slots?doctorId=doc-1&date=2026-06-03&durationMinutes=60&timeZone=Europe/Rome",
      ),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.slots?.length).toBeGreaterThan(0);
    expect(json.slots[0]).toEqual(
      expect.objectContaining({
        startsAtLocal: expect.stringMatching(/^2026-06-03T/),
        endsAtLocal: expect.stringMatching(/^2026-06-03T/),
        label: expect.any(String),
      }),
    );
  });

  it("returns the first available slot when mode=first", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/appointments/alternative-slots?doctorId=doc-1&mode=first&date=2026-06-03&durationMinutes=60&timeZone=Europe/Rome",
      ),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.slots).toHaveLength(1);
    expect(json.slots[0]?.label).toEqual(expect.any(String));
  });

  it("rejects incomplete search params", async () => {
    const response = await GET(
      new Request("http://localhost/api/appointments/alternative-slots?doctorId=doc-1"),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.slots).toEqual([]);
    expect(json.blockedReason).toContain("non validi");
  });
});