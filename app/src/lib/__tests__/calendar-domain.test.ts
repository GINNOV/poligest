import { describe, expect, it } from "vitest";
import {
  appendCalendarQueryParam,
  dateEndExclusive,
  dateStart,
  ensureCalendarReturnTo,
  formatCalendarLocalInput,
  parseCalendarDateParam,
  resolveCalendarMonthKey,
  weekdayIso,
} from "@/lib/calendar/domain";

describe("calendar domain", () => {
  it("maps sunday to ISO weekday 7", () => {
    expect(weekdayIso(new Date("2026-03-29T12:00:00.000Z"))).toBe(7);
  });

  it("parses date params and formats local inputs", () => {
    expect(parseCalendarDateParam("2026-03-25")?.getFullYear()).toBe(2026);
    expect(parseCalendarDateParam("bad")).toBeNull();
    expect(formatCalendarLocalInput(new Date("2026-03-25T09:05:00"))).toMatch(
      /^2026-03-25T09:05$/,
    );
  });

  it("normalizes day boundaries and safe return urls", () => {
    const date = new Date("2026-03-25T15:20:00.000Z");
    expect(dateStart(date).getHours()).toBe(0);
    expect(dateEndExclusive(date).getDate()).toBe(date.getDate() + 1);
    expect(ensureCalendarReturnTo("/calendar?view=week")).toBe("/calendar?view=week");
    expect(ensureCalendarReturnTo("/agenda")).toBe("/calendar");
  });

  it("appends encoded query params", () => {
    expect(appendCalendarQueryParam("/calendar", "error", "orario non valido")).toBe(
      "/calendar?error=orario%20non%20valido",
    );
  });

  it("uses the selected week month in week view navigation", () => {
    expect(
      resolveCalendarMonthKey({
        monthParam: undefined,
        view: "week",
        weekStart: new Date("2026-05-31T22:00:00.000Z"),
        now: new Date("2026-05-26T12:00:00.000Z"),
        timeZone: "Europe/Rome",
      }),
    ).toBe("2026-06");
  });

  it("ignores stale month params in week view", () => {
    expect(
      resolveCalendarMonthKey({
        monthParam: "2026-05",
        view: "week",
        weekStart: new Date("2026-05-31T22:00:00.000Z"),
        now: new Date("2026-05-26T12:00:00.000Z"),
        timeZone: "Europe/Rome",
      }),
    ).toBe("2026-06");
  });
});
