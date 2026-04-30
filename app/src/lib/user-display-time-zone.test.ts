import { test, expect } from "vitest";
import { getMonthGridInTimeZone, formatDateInputValueInTimeZone } from "./user-display-time-zone";

test("getMonthGridInTimeZone starts on a Monday (Italian locale)", () => {
  const baseDate = new Date("2026-02-15");
  const timeZone = "Europe/Rome";
  const grid = getMonthGridInTimeZone(baseDate, timeZone);
  
  // Feb 1st 2026 is Sunday
  // Grid MUST start on Monday Jan 26th
  const firstDayStr = formatDateInputValueInTimeZone(grid[0], timeZone);
  console.log("First day in grid (Target TZ):", firstDayStr);
  
  expect(firstDayStr).toBe("2026-01-26");
});
