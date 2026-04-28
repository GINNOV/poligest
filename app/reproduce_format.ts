import { formatCalendarLocalInput } from "./src/lib/calendar/domain";
import { formatDateInDisplayTimeZone, formatDateInputValueInTimeZone } from "./src/lib/user-display-time-zone";

const testDate = new Date("2026-04-28T14:30:00Z");
const tz = "Europe/Rome";

console.log("Date Part (en-CA):", formatDateInputValueInTimeZone(testDate, tz));
console.log("Time Part (it-IT):", formatDateInDisplayTimeZone(testDate, {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
}, tz));

const result = formatCalendarLocalInput(testDate, tz);
console.log("Full Result:", result);

try {
  const parsed = new Date(result);
  console.log("Parsed Date valid?", !isNaN(parsed.getTime()));
  console.log("Parsed Date ISO:", parsed.toISOString());
} catch (e) {
  console.log("Parsing failed", e);
}
