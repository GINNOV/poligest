import { describe, expect, it, vi } from "vitest";
import {
  computeAppointmentDurationMinutes,
  findAlternativeSlots,
  findFirstAvailableSlot,
} from "@/lib/appointments/find-alternative-slots";
import { parseDateTimeLocalInTimeZone } from "@/lib/time-zone";

const availabilityWindows = [
  { doctorId: "doc-1", dayOfWeek: 3, startMinute: 9 * 60, endMinute: 13 * 60 },
];

describe("findAlternativeSlots", () => {
  it("returns free slots that fit the appointment duration", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T08:00:00.000Z"));

    const result = findAlternativeSlots({
      date: "2026-06-03",
      durationMinutes: 60,
      doctorId: "doc-1",
      timeZone: "Europe/Rome",
      availabilityWindows,
      practiceClosures: [],
      existingAppointments: [
        {
          startsAt: parseDateTimeLocalInTimeZone("2026-06-03T09:00", "Europe/Rome")!,
          endsAt: parseDateTimeLocalInTimeZone("2026-06-03T10:00", "Europe/Rome")!,
        },
      ],
      slotStepMinutes: 30,
      maxResults: 4,
    });

    expect(result.slots.length).toBeGreaterThan(0);
    expect(result.slots[0]?.label).toMatch(/–/);
    expect(result.slots.every((slot) => slot.startsAtLocal.startsWith("2026-06-03"))).toBe(true);
    expect(result.slots.some((slot) => slot.startsAtLocal.includes("T09:00"))).toBe(false);
    expect(result.slots.some((slot) => slot.startsAtLocal.includes("T10:00"))).toBe(true);
  });

  it("skips slots that overlap existing appointments", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T08:00:00.000Z"));

    const result = findAlternativeSlots({
      date: "2026-06-03",
      durationMinutes: 60,
      doctorId: "doc-1",
      timeZone: "Europe/Rome",
      availabilityWindows,
      practiceClosures: [],
      existingAppointments: [
        {
          startsAt: parseDateTimeLocalInTimeZone("2026-06-03T09:00", "Europe/Rome")!,
          endsAt: parseDateTimeLocalInTimeZone("2026-06-03T12:30", "Europe/Rome")!,
        },
      ],
      slotStepMinutes: 30,
      maxResults: 10,
    });

    expect(result.slots).toEqual([]);
  });

  it("reports when the practice is closed on the selected day", () => {
    const result = findAlternativeSlots({
      date: "2026-06-03",
      durationMinutes: 30,
      doctorId: "doc-1",
      timeZone: "Europe/Rome",
      availabilityWindows,
      practiceClosures: [],
      practiceWeeklyClosures: [{ dayOfWeek: 3, title: "Mercoledì" }],
      existingAppointments: [],
    });

    expect(result.slots).toEqual([]);
    expect(result.blockedReason).toContain("chiuso");
  });
});

describe("findFirstAvailableSlot", () => {
  it("returns the earliest free slot across multiple days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T08:00:00.000Z"));

    const result = findFirstAvailableSlot({
      fromDate: "2026-06-03",
      maxDays: 5,
      durationMinutes: 60,
      doctorId: "doc-1",
      timeZone: "Europe/Rome",
      availabilityWindows,
      practiceClosures: [],
      existingAppointments: [
        {
          startsAt: parseDateTimeLocalInTimeZone("2026-06-03T09:00", "Europe/Rome")!,
          endsAt: parseDateTimeLocalInTimeZone("2026-06-03T13:00", "Europe/Rome")!,
        },
      ],
      slotStepMinutes: 30,
    });

    expect(result.slots).toHaveLength(1);
    expect(result.slots[0]?.startsAtLocal.startsWith("2026-06-04")).toBe(true);
    expect(result.slots[0]?.label).toMatch(/·/);
  });

  it("reports when no slot is found within the search window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T08:00:00.000Z"));

    const result = findFirstAvailableSlot({
      fromDate: "2026-06-03",
      maxDays: 1,
      durationMinutes: 60,
      doctorId: "doc-1",
      timeZone: "Europe/Rome",
      availabilityWindows,
      practiceClosures: [],
      existingAppointments: [
        {
          startsAt: parseDateTimeLocalInTimeZone("2026-06-03T09:00", "Europe/Rome")!,
          endsAt: parseDateTimeLocalInTimeZone("2026-06-03T13:00", "Europe/Rome")!,
        },
      ],
      slotStepMinutes: 30,
    });

    expect(result.slots).toEqual([]);
    expect(result.blockedReason).toContain("1 giorni");
  });
});

describe("computeAppointmentDurationMinutes", () => {
  it("derives duration from datetime-local values", () => {
    expect(
      computeAppointmentDurationMinutes("2026-06-03T09:00", "2026-06-03T10:15", "Europe/Rome"),
    ).toBe(75);
  });
});