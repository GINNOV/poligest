import { DEFAULT_PRACTICE_TIME_ZONE } from "@/lib/practice-time-zone";
import { USER_TIME_ZONE_STORAGE_KEY } from "@/lib/app-preferences";

export const DISPLAY_TIME_ZONE_OPTIONS = [
  { value: "Europe/Rome", label: "Italia (Rome)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "Regno Unito (London)" },
  { value: "America/New_York", label: "USA East (New York)" },
  { value: "America/Chicago", label: "USA Central (Chicago)" },
  { value: "America/Denver", label: "USA Mountain (Denver)" },
  { value: "America/Los_Angeles", label: "USA Pacific (Los Angeles)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
] as const;

export type UserDisplayTimeZone = (typeof DISPLAY_TIME_ZONE_OPTIONS)[number]["value"];

export function isSupportedDisplayTimeZone(value: string | null | undefined): value is UserDisplayTimeZone {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function resolveUserDisplayTimeZone(
  value: string | null | undefined,
  fallback = DEFAULT_PRACTICE_TIME_ZONE
) {
  return isSupportedDisplayTimeZone(value) ? value : fallback;
}

export function getBrowserUserDisplayTimeZone(fallback = DEFAULT_PRACTICE_TIME_ZONE) {
  if (typeof window === "undefined") {
    return fallback;
  }

  const stored = window.localStorage.getItem(USER_TIME_ZONE_STORAGE_KEY);
  if (isSupportedDisplayTimeZone(stored)) {
    return stored;
  }

  const systemTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return resolveUserDisplayTimeZone(systemTimeZone, fallback);
}

/**
 * Returns a Date object that represents "now" but normalized to midnight 
 * or used as a base for timezone-aware calculations.
 */
export function getNowInTimeZone(timeZone: string) {
  const now = new Date();
  const dateStr = formatDateInputValueInTimeZone(now, timeZone);
  return parseDateAtMidnightInTimeZone(dateStr, timeZone);
}

export function formatDateInDisplayTimeZone(
  date: Date,
  options: Intl.DateTimeFormatOptions,
  timeZone: string
) {
  return new Intl.DateTimeFormat("it-IT", { ...options, timeZone }).format(date);
}

export function formatDateInputValueInTimeZone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function formatTimeInputValueInTimeZone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

/**
 * Creates a Date object representing midnight in the specified timeZone.
 */
export function parseDateAtMidnightInTimeZone(dateStr: string, timeZone: string) {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date(NaN);
  
  // Create a date in UTC at that specific calendar day
  const d = new Date(`${dateStr}T00:00:00Z`);
  
  // Shift it back/forward to match the local 00:00:00
  // We use Intl to find the exact offset for that specific date in that timezone
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(d);
  
  const localYear = parseInt(parts.find(p => p.type === "year")!.value);
  const localMonth = parseInt(parts.find(p => p.type === "month")!.value);
  const localDay = parseInt(parts.find(p => p.type === "day")!.value);
  const localHour = parseInt(parts.find(p => p.type === "hour")!.value);
  
  // Calculate how many milliseconds d (at UTC) is ahead/behind of local 00:00
  // This is a bit complex due to DST, but for midnight it's usually safe
  const localDate = new Date(`${localYear}-${localMonth.toString().padStart(2, '0')}-${localDay.toString().padStart(2, '0')}T${localHour.toString().padStart(2, '0')}:00:00Z`);
  const offset = d.getTime() - localDate.getTime();
  
  return new Date(d.getTime() + offset);
}

/**
 * Gets start and end of week (Monday-Sunday) in the specified timeZone.
 */
export function getWeekRangeInTimeZone(baseDate: Date, timeZone: string) {
  const days = getWeekDaysInTimeZone(baseDate, timeZone);
  return { start: days[0], end: new Date(days[6].getTime() + 24 * 60 * 60 * 1000 - 1) };
}

/**
 * Returns exactly 7 dates representing Mon-Sun of the week containing baseDate.
 */
export function getWeekDaysInTimeZone(baseDate: Date, timeZone: string) {
  // 1. Get the date string in the target timezone (e.g. "2026-04-28")
  const dateStr = formatDateInputValueInTimeZone(baseDate, timeZone);
  // 2. Parse it as a UTC date to get "pure" calendar values
  const [y, m, d] = dateStr.split("-").map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  
  // 3. Find the day of week in UTC (0=Sun, 1=Mon)
  const utcDay = utcDate.getUTCDay();
  
  // 4. Calculate diff to Monday (1)
  const diffToMonday = (utcDay === 0 ? -6 : 1 - utcDay);
  
  // 5. Generate the 7 days
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const targetUtc = new Date(utcDate.getTime() + (diffToMonday + i) * 24 * 60 * 60 * 1000);
    const targetStr = targetUtc.toISOString().split("T")[0];
    days.push(parseDateAtMidnightInTimeZone(targetStr, timeZone));
  }
  return days;
}

/**
 * Gets start and end of month in the specified timeZone.
 */
export function getMonthRangeInTimeZone(baseDate: Date, timeZone: string) {
  const dateStr = formatDateInputValueInTimeZone(baseDate, timeZone);
  const year = parseInt(dateStr.split("-")[0]);
  const month = parseInt(dateStr.split("-")[1]);
  
  const startStr = `${year}-${month.toString().padStart(2, '0')}-01`;
  const start = parseDateAtMidnightInTimeZone(startStr, timeZone);
  
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthStartStr = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;
  const end = new Date(parseDateAtMidnightInTimeZone(nextMonthStartStr, timeZone).getTime() - 1);
  
  return { start, end };
}

/**
 * Returns the day of week (1=Mon, ..., 7=Sun) for a given date in the target timeZone.
 */
export function weekdayIsoInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "narrow", // S, M, T, W, T, F, S
  }).formatToParts(date);
  
  // Actually, narrow weekday is not reliable for mapping to 1-7 easily due to duplicates.
  // Better to get the day of week index via numeric format if possible, 
  // but Intl doesn't have a direct "day of week index" part.
  
  // Use a safer approach: get the day string and map it
  const dayName = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  
  const map: Record<string, number> = {
    'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7
  };
  return map[dayName] || 1;
}

/**
 * Performs month arithmetic on a "YYYY-MM" key.
 */
export function getRelativeMonthKey(monthKey: string, offset: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + offset, 1));
  const newYear = d.getUTCFullYear();
  const newMonth = d.getUTCMonth() + 1;
  return `${newYear}-${newMonth.toString().padStart(2, '0')}`;
}

/**
 * Returns exactly 42 dates (6 weeks) representing the month grid for the month 
 * containing baseDate in the specified timeZone.
 * The grid starts on Monday of the week containing the 1st of the month.
 */
export function getMonthGridInTimeZone(baseDate: Date, timeZone: string) {
  // 1. Get the month and year in the target timezone
  const dateStr = formatDateInputValueInTimeZone(baseDate, timeZone);
  const [y, m] = dateStr.split("-").map(Number);
  
  // 2. Use a "pure" UTC date to represent this calendar day for arithmetic
  const utcFirst = new Date(Date.UTC(y, m - 1, 1));
  
  // 3. Find the day of week in UTC (0=Sun, 1=Mon, ..., 6=Sat)
  const utcDay = utcFirst.getUTCDay();
  
  // 4. Calculate how many days to go back to reach Monday
  // If utcDay is 0 (Sun), go back 6 days
  // If utcDay is 1 (Mon), go back 0 days
  // If utcDay is 2 (Tue), go back 1 day
  const diffToMonday = utcDay === 0 ? -6 : 1 - utcDay;
  
  // 5. Generate exactly 42 days (6 full weeks)
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    // Start from Monday in UTC
    const currentUtc = new Date(utcFirst.getTime() + (diffToMonday + i) * 24 * 60 * 60 * 1000);
    const targetStr = currentUtc.toISOString().split("T")[0];
    days.push(parseDateAtMidnightInTimeZone(targetStr, timeZone));
  }
  return days;
}
