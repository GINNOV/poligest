import { getWeekDaysInTimeZone, formatDateInputValueInTimeZone } from "./src/lib/user-display-time-zone";

const tz = "Europe/Rome";
// April 28, 2026 is Tuesday
const testDate = new Date("2026-04-28T10:00:00Z");

console.log("Input Date:", testDate.toISOString());
const days = getWeekDaysInTimeZone(testDate, tz);

console.log("Week days:");
days.forEach((d, i) => {
  console.log(`${i}: ${d.toISOString()} -> ${formatDateInputValueInTimeZone(d, tz)}`);
});

// Sunday May 3, 2026
const sunday = new Date("2026-05-03T10:00:00Z");
console.log("\nInput Sunday:", sunday.toISOString());
const daysFromSunday = getWeekDaysInTimeZone(sunday, tz);
daysFromSunday.forEach((d, i) => {
  console.log(`${i}: ${d.toISOString()} -> ${formatDateInputValueInTimeZone(d, tz)}`);
});
