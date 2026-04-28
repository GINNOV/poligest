import { parseDateAtMidnightInTimeZone } from "./src/lib/user-display-time-zone";

const tz = "Europe/Rome";
const testDateStr = "2026-05-03"; // Sunday
const midnight = parseDateAtMidnightInTimeZone(testDateStr, tz);

const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).formatToParts(midnight);
console.log("Parts for Sunday:", JSON.stringify(parts));

const weekdayShort = parts.find(p => p.type === "weekday")?.value;
console.log("Weekday Short:", weekdayShort);

const weekdayMap: Record<string, number> = { "Sun": 0, "Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6 };
console.log("Day Index:", weekdayMap[weekdayShort ?? ""] ?? "NOT FOUND");
