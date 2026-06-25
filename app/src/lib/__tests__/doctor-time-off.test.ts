import { describe, expect, it } from "vitest";
import {
  isDoctorTimeOffActive,
  parseDoctorTimeOffDateRange,
} from "@/lib/doctor-time-off";

describe("doctor-time-off", () => {
  it("parses an inclusive multi-day range in the display timezone", () => {
    const { startsAt, endsAt } = parseDoctorTimeOffDateRange(
      "2026-08-01",
      "2026-08-03",
      "Europe/Rome",
    );

    expect(startsAt.toISOString()).toBe("2026-07-31T22:00:00.000Z");
    expect(endsAt.toISOString()).toBe("2026-08-03T21:59:59.999Z");
  });

  it("detects when a doctor is on time off for a given day", () => {
    const dayStart = new Date("2026-08-02T00:00:00.000Z");
    const dayEnd = new Date("2026-08-03T00:00:00.000Z");

    expect(
      isDoctorTimeOffActive("doc-1", dayStart, dayEnd, [
        {
          id: "off-1",
          doctorId: "doc-1",
          title: "Ferie",
          startsAt: "2026-08-01T00:00:00.000Z",
          endsAt: "2026-08-05T23:59:59.999Z",
        },
      ]),
    ).toBe(true);

    expect(
      isDoctorTimeOffActive("doc-2", dayStart, dayEnd, [
        {
          id: "off-1",
          doctorId: "doc-1",
          title: "Ferie",
          startsAt: "2026-08-01T00:00:00.000Z",
          endsAt: "2026-08-05T23:59:59.999Z",
        },
      ]),
    ).toBe(false);
  });
});