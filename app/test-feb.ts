
import * as TZ from "./src/lib/user-display-time-zone";

const timeZone = "Europe/Rome";
const baseMonth = TZ.parseDateAtMidnightInTimeZone("2026-02-01", timeZone);
const selectedMonthKey = "2026-02";

const grid = TZ.getMonthGridInTimeZone(baseMonth, timeZone);
const days = grid.filter(day => {
  const key = TZ.formatDateInputValueInTimeZone(day, timeZone);
  return key.startsWith(selectedMonthKey);
});

console.log("Base Month:", baseMonth.toISOString());
console.log("Selected Month Key:", selectedMonthKey);
console.log("Grid length:", grid.length);
console.log("Filtered days length:", days.length);

days.forEach(d => {
  console.log(TZ.formatDateInputValueInTimeZone(d, timeZone));
});
