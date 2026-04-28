import { describe, expect, it } from "vitest";
import { formatCalendarLocalInput } from "../calendar/domain";
import { formatDateInDisplayTimeZone, formatDateInputValueInTimeZone } from "../user-display-time-zone";

describe("Timezone Consistency", () => {
  const testDate = new Date("2026-04-28T14:30:00Z"); // 14:30 UTC
  const timeZones = ["Europe/Rome", "America/New_York", "Asia/Tokyo", "UTC"];

  it("produces consistent local input strings across different timezones", () => {
    for (const tz of timeZones) {
      // Current implementation in Agenda
      const datePart = formatDateInputValueInTimeZone(testDate, tz);
      const timePart = formatDateInDisplayTimeZone(testDate, {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }, tz);
      const agendaFormat = `${datePart}T${timePart}`;

      // New implementation in Calendar Domain
      const calendarFormat = formatCalendarLocalInput(testDate, tz);

      expect(calendarFormat).toBe(agendaFormat);
      
      // Verify specific values for Europe/Rome (UTC+2 in April)
      if (tz === "Europe/Rome") {
        expect(calendarFormat).toBe("2026-04-28T16:30");
      }
      
      // Verify specific values for America/New_York (UTC-4 in April)
      if (tz === "America/New_York") {
        expect(calendarFormat).toBe("2026-04-28T10:30");
      }
    }
  });

  it("handles midnight transitions correctly across timezones", () => {
    const midnightDate = new Date("2026-04-28T23:30:00Z"); // 23:30 UTC
    
    // In Rome it will be 01:30 of the NEXT day (2026-04-29)
    const romeFormat = formatCalendarLocalInput(midnightDate, "Europe/Rome");
    expect(romeFormat).toBe("2026-04-29T01:30");
    
    // In New York it will be 19:30 of the SAME day (2026-04-28)
    const nyFormat = formatCalendarLocalInput(midnightDate, "America/New_York");
    expect(nyFormat).toBe("2026-04-28T19:30");
  });
});
