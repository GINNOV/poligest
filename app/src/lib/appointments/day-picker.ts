export const ITALIAN_MONTHS = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
] as const;

export function addCalendarDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function appointmentDateParts(isoDate: string) {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/** Keeps the day inside the chosen month, so 31 January becomes 28 February. */
export function composeAppointmentDate(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || year < 1900 || year > 2100) return null;
  const safeDay = Math.min(Math.max(day, 1), daysInMonth(year, month));
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${year}-${pad(month)}-${pad(safeDay)}`;
}

/** Current year sits in the list, plus one year back and two ahead. An older visit keeps its own year. */
export function appointmentYearOptions(todayIso: string, selectedIso: string) {
  const current = Number(todayIso.slice(0, 4));
  const selected = Number(selectedIso.slice(0, 4));
  const years = new Set<number>();
  for (let year = current - 1; year <= current + 2; year += 1) years.add(year);
  if (selected >= 1900 && selected <= 2100) years.add(selected);
  return [...years].sort((left, right) => left - right);
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
