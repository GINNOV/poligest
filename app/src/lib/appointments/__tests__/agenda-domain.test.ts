import { describe, expect, it } from "vitest";
import { AppointmentStatus } from "@prisma/client";
import {
  adjustAppointmentEndsAt,
  isAppointmentStatus,
  isSameAgendaAppointmentSlot,
  normalizeAgendaSearchValue,
  parseAgendaDateRange,
  parseAgendaPageNumber,
} from "@/lib/appointments/agenda-domain";

describe("agenda-domain", () => {
  it("parses a page number with a lower bound of 1", () => {
    expect(parseAgendaPageNumber(undefined)).toBe(1);
    expect(parseAgendaPageNumber("0")).toBe(1);
    expect(parseAgendaPageNumber("3")).toBe(3);
  });

  it("normalizes search values", () => {
    expect(normalizeAgendaSearchValue("  Richiamo ")).toBe("richiamo");
    expect(normalizeAgendaSearchValue("   ")).toBeUndefined();
  });

  it("parses a date range for the given day", () => {
    const range = parseAgendaDateRange("2026-03-25");
    expect(range?.gte.getFullYear()).toBe(2026);
    expect(range?.gte.getMonth()).toBe(2);
    expect(range?.gte.getDate()).toBe(25);
    expect(range?.gte.getHours()).toBe(0);
    expect(range?.lt.getDate()).toBe(26);
    expect(range?.lt.getHours()).toBe(0);
  });

  it("adjusts appointment end time when the provided end is not after the start", () => {
    const startsAt = new Date("2026-03-25T10:00:00.000Z");
    const endsAt = new Date("2026-03-25T09:45:00.000Z");
    expect(adjustAppointmentEndsAt(startsAt, endsAt).toISOString()).toBe(
      "2026-03-25T10:30:00.000Z",
    );
  });

  it("recognizes valid appointment statuses", () => {
    expect(isAppointmentStatus(AppointmentStatus.CONFIRMED)).toBe(true);
    expect(isAppointmentStatus("anything-else")).toBe(false);
  });

  it("compares appointment slots with a one second tolerance", () => {
    const current = {
      doctorId: "doc-1",
      startsAt: new Date("2026-03-25T10:00:00.000Z"),
      endsAt: new Date("2026-03-25T10:30:00.000Z"),
    };
    expect(
      isSameAgendaAppointmentSlot(current, {
        doctorId: "doc-1",
        startsAt: new Date("2026-03-25T10:00:00.500Z"),
        endsAt: new Date("2026-03-25T10:30:00.400Z"),
      }),
    ).toBe(true);
    expect(
      isSameAgendaAppointmentSlot(current, {
        doctorId: "doc-2",
        startsAt: new Date("2026-03-25T10:00:00.500Z"),
        endsAt: new Date("2026-03-25T10:30:00.400Z"),
      }),
    ).toBe(false);
  });
});
