import { formatCalendarLocalInput } from "./src/lib/calendar/domain";

const tz = "Europe/Rome";
// Appointment at 1:30 AM on April 20, 2026 (Rome time)
// This is April 19, 23:30 UTC
const apptDate = new Date("2026-04-19T23:30:00Z");

const startsAtLocal = formatCalendarLocalInput(apptDate, tz);
console.log("startsAtLocal:", startsAtLocal);

const weekParam = startsAtLocal.split("T")[0];
console.log("Generated weekParam:", weekParam);
