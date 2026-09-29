import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  appointmentDateParts,
  appointmentYearOptions,
  composeAppointmentDate,
  daysInMonth,
  describeVisitDay,
} from "@/lib/appointments/day-picker";

const today = "2026-09-29";

describe("appointment day lists", () => {
  it("splits a visit day into day, month, and year", () => {
    expect(appointmentDateParts("2026-09-29")).toEqual({ year: 2026, month: 9, day: 29 });
    expect(appointmentDateParts("2026-02-31")).toBeNull();
  });

  it("moves 31 January back to the last day of February", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(composeAppointmentDate(2026, 2, 31)).toBe("2026-02-28");
    expect(composeAppointmentDate(2024, 2, 31)).toBe("2024-02-29");
  });

  it("offers the current year by default and keeps an older visit year", () => {
    expect(appointmentYearOptions(today, today)).toEqual([2025, 2026, 2027, 2028]);
    expect(appointmentYearOptions(today, "2020-03-01")).toContain(2020);
  });

  it("says the chosen day in a full sentence", () => {
    expect(describeVisitDay(today, today)).toMatch(/^Oggi, martedì 29 settembre$/);
    expect(describeVisitDay(addCalendarDays(today, 1), today)).toMatch(/^Domani,/);
  });
});
