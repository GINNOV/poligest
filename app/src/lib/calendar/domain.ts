import { 
  formatDateInputValueInTimeZone,
  formatTimeInputValueInTimeZone,
  getMonthGridInTimeZone,
} from "@/lib/user-display-time-zone";

export function weekdayIso(date: Date) {
  const jsDay = date.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function dateStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function dateEndExclusive(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
}

export function parseCalendarDateParam(value: string | undefined) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function formatCalendarLocalInput(date: Date, timeZone?: string) {
  if (timeZone) {
    const datePart = formatDateInputValueInTimeZone(date, timeZone);
    const timePart = formatTimeInputValueInTimeZone(date, timeZone);
    return `${datePart}T${timePart}`;
  }
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function resolveCalendarMonthKey({
  monthParam,
  view,
  weekStart,
  now,
  timeZone,
}: {
  monthParam?: string;
  view: "month" | "week" | "day";
  weekStart: Date;
  now: Date;
  timeZone: string;
}) {
  if (view === "week" || view === "day") {
    return formatDateInputValueInTimeZone(weekStart, timeZone).slice(0, 7);
  }

  return monthParam?.match(/^\d{4}-\d{2}$/)
    ? monthParam
    : formatDateInputValueInTimeZone(now, timeZone).slice(0, 7);
}

export function getCalendarMonthDays({
  baseMonth,
  selectedMonthKey,
  timeZone,
}: {
  baseMonth: Date;
  selectedMonthKey: string;
  timeZone: string;
}) {
  const gridDays = getMonthGridInTimeZone(baseMonth, timeZone);
  const selectedMonthDays = gridDays.filter((day) =>
    formatDateInputValueInTimeZone(day, timeZone).startsWith(selectedMonthKey)
  );

  if (selectedMonthDays.length > 0) {
    return selectedMonthDays;
  }

  const baseMonthKey = formatDateInputValueInTimeZone(baseMonth, timeZone).slice(0, 7);
  return gridDays.filter((day) =>
    formatDateInputValueInTimeZone(day, timeZone).startsWith(baseMonthKey)
  );
}

export function ensureCalendarReturnTo(value: string | null) {
  if (!value || !value.startsWith("/calendar")) return "/calendar";
  return value;
}

export function appendCalendarQueryParam(url: string, key: string, value: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${key}=${encodeURIComponent(value)}`;
}
