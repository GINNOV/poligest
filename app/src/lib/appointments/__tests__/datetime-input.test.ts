import { describe, expect, it } from "vitest";
import {
  addMinutesToDateTimeLocal,
  composeDateTimeLocal,
  formatAppointmentSlotSummary,
  formatEuropeanDate,
  formatEuropeanTime,
  parseEuropeanDate,
  parseEuropeanTime,
  splitDateTimeLocal,
} from "@/lib/appointments/datetime-input";

describe("datetime-input", () => {
  it("splits and composes datetime-local values", () => {
    expect(splitDateTimeLocal("2026-06-03T10:15")).toEqual({
      date: "2026-06-03",
      time: "10:15",
    });
    expect(composeDateTimeLocal("2026-06-03", "10:15")).toBe("2026-06-03T10:15");
  });

  it("adds minutes to a datetime-local value", () => {
    expect(addMinutesToDateTimeLocal("2026-06-03T10:00", 30)).toBe("2026-06-03T10:30");
    expect(addMinutesToDateTimeLocal("2026-06-03T10:00", 90)).toBe("2026-06-03T11:30");
  });

  it("shows calendar dates as day/month/year", () => {
    expect(formatEuropeanDate("2026-09-22")).toBe("22/09/2026");
    expect(parseEuropeanDate("22/09/2026")).toBe("2026-09-22");
    expect(parseEuropeanDate("22-9-2026")).toBe("2026-09-22");
    expect(parseEuropeanDate("22092026")).toBe("2026-09-22");
    expect(parseEuropeanDate("2026-09-22")).toBe("2026-09-22");
    expect(parseEuropeanDate("31/02/2026")).toBeNull();
    expect(parseEuropeanDate("09/22/2026")).toBeNull();
  });

  it("shows visit times on a 24-hour clock", () => {
    expect(formatEuropeanTime("14:30")).toBe("14:30");
    expect(parseEuropeanTime("14:30")).toBe("14:30");
    expect(parseEuropeanTime("2:05")).toBe("02:05");
    expect(parseEuropeanTime("1430")).toBe("14:30");
    expect(parseEuropeanTime("14.30")).toBe("14:30");
    expect(parseEuropeanTime("2:30 PM")).toBeNull();
    expect(parseEuropeanTime("24:00")).toBeNull();
  });

  it("formats appointment slot summaries", () => {
    const label = formatAppointmentSlotSummary(
      "2026-06-03T10:00",
      "2026-06-03T11:00",
      "Europe/Rome",
    );
    expect(label).toMatch(/·/);
    expect(label).toMatch(/–/);
  });
});