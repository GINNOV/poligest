import { describe, expect, it } from "vitest";
import { 
  formatDateInputValueInTimeZone, 
  getWeekRangeInTimeZone, 
  parseDateAtMidnightInTimeZone 
} from "../user-display-time-zone";

describe("Calendar Navigation Logic", () => {
  const tz = "Europe/Rome";

  it("calculates the correct week parameter for navigation (Monday start)", () => {
    // Wednesday, April 15, 2026
    const apptDate = new Date("2026-04-15T10:00:00Z"); 
    
    // In Rome (UTC+2) it's still April 15, 12:00
    const weekRange = getWeekRangeInTimeZone(apptDate, tz);
    
    // The week should start on Monday, April 13, 2026
    expect(formatDateInputValueInTimeZone(weekRange.start, tz)).toBe("2026-04-13");
  });

  it("handles week transitions at midnight correctly", () => {
    // Sunday night, April 19, 2026, 23:30 UTC
    // In Rome (UTC+2) it's Monday, April 20, 01:30 AM
    const lateSunday = new Date("2026-04-19T23:30:00Z");
    
    const weekRange = getWeekRangeInTimeZone(lateSunday, tz);
    
    // It should navigate to the week of April 20, not April 13
    expect(formatDateInputValueInTimeZone(weekRange.start, tz)).toBe("2026-04-20");
  });

  it("extracts edit parameter correctly (logic simulation)", () => {
    const mockAppts = [
      { id: "appt-1", title: "Test 1" },
      { id: "appt-2", title: "Test 2" }
    ];
    
    const initialAppointmentId = "appt-2";
    const found = mockAppts.find(a => a.id === initialAppointmentId);
    
    expect(found?.id).toBe("appt-2");
  });
});
