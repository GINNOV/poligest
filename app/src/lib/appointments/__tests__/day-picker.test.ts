import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  dayWindowStart,
  describeVisitDay,
  parseLooseAppointmentDate,
  visitDayChoices,
} from "@/lib/appointments/day-picker";

const today = "2026-09-29";

describe("appointment day picker", () => {
  it("names today and tomorrow, then the weekday", () => {
    const days = visitDayChoices(today, today, 3);
    expect(days.map((day) => day.name)).toEqual(["Oggi", "Domani", "gio"]);
    expect(days[0]).toMatchObject({ iso: "2026-09-29", dayNumber: "29", month: "set" });
    expect(days[2].iso).toBe("2026-10-01");
  });

  it("keeps the coming week in view when the visit is soon", () => {
    expect(dayWindowStart("2026-10-02", today)).toBe(today);
    expect(dayWindowStart("2026-10-20", today)).toBe("2026-10-20");
    expect(dayWindowStart("2026-09-20", today)).toBe("2026-09-20");
  });

  it("reads a day and month without a year", () => {
    expect(parseLooseAppointmentDate("15/10", today)).toBe("2026-10-15");
    expect(parseLooseAppointmentDate("15/01", today)).toBe("2027-01-15");
    expect(parseLooseAppointmentDate("30/09/2026", today)).toBe("2026-09-30");
    expect(parseLooseAppointmentDate("domani", today)).toBeNull();
  });

  it("says the chosen day in a full sentence", () => {
    expect(describeVisitDay(today, today)).toMatch(/^Oggi, martedì 29 settembre$/);
    expect(describeVisitDay(addCalendarDays(today, 1), today)).toMatch(/^Domani,/);
  });
});
