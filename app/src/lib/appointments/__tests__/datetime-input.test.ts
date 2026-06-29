import { describe, expect, it } from "vitest";
import {
  addMinutesToDateTimeLocal,
  composeDateTimeLocal,
  formatAppointmentSlotSummary,
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