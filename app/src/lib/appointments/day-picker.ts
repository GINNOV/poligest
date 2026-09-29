import { parseEuropeanDate } from "@/lib/appointments/datetime-input";

export function addCalendarDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

export function dayWindowStart(selected: string, today: string) {
  const earliest = addCalendarDays(today, -14);
  if (selected < earliest) return earliest;
  if (selected < today) return selected;
  if (selected <= addCalendarDays(today, 6)) return today;
  return selected;
}

export function parseLooseAppointmentDate(value: string, today: string) {
  const full = parseEuropeanDate(value);
  if (full) return full;

  const short = value.trim().match(/^(\d{1,2})[\/.\-](\d{1,2})$/);
  if (!short) return null;

  const year = Number(today.slice(0, 4));
  const thisYear = parseEuropeanDate(`${short[1]}/${short[2]}/${year}`);
  if (!thisYear) return null;
  if (thisYear < addCalendarDays(today, -30)) {
    return parseEuropeanDate(`${short[1]}/${short[2]}/${year + 1}`);
  }
  return thisYear;
}

function noon(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function describeVisitDay(isoDate: string, today: string) {
  const long = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(noon(isoDate));
  if (isoDate === today) return `Oggi, ${long}`;
  if (isoDate === addCalendarDays(today, 1)) return `Domani, ${long}`;
  return long.charAt(0).toUpperCase() + long.slice(1);
}

export type VisitDayChoice = {
  iso: string;
  name: string;
  dayNumber: string;
  month: string;
};

export function visitDayChoices(windowStart: string, today: string, count = 7): VisitDayChoice[] {
  const weekday = new Intl.DateTimeFormat("it-IT", { weekday: "short", timeZone: "UTC" });
  const month = new Intl.DateTimeFormat("it-IT", { month: "short", timeZone: "UTC" });

  return Array.from({ length: count }, (_, index) => {
    const iso = addCalendarDays(windowStart, index);
    const when = noon(iso);
    const shortName = weekday.format(when).replace(".", "");
    const name =
      iso === today ? "Oggi" : iso === addCalendarDays(today, 1) ? "Domani" : shortName;
    return {
      iso,
      name,
      dayNumber: String(when.getUTCDate()),
      month: month.format(when).replace(".", ""),
    };
  });
}
