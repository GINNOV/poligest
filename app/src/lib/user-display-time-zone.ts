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
