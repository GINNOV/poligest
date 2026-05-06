export const DEFAULT_PRACTICE_TIME_ZONE = "Europe/Rome";
export const PRACTICE_SETTINGS_ID = "default";
export const PRACTICE_TIME_ZONE_STORAGE_KEY = "poligest:practice-time-zone";

export const PRACTICE_TIME_ZONE_OPTIONS = [
  { value: "Europe/Rome", label: "CEST (ROMA)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "BST (London)" },
  { value: "America/New_York", label: "ET (New York)" },
  { value: "America/Los_Angeles", label: "PT (Los Angeles)" },
] as const;

export type PracticeTimeZone = (typeof PRACTICE_TIME_ZONE_OPTIONS)[number]["value"];

const SUPPORTED_TIME_ZONES = new Set<string>(PRACTICE_TIME_ZONE_OPTIONS.map((option) => option.value));

export function isPracticeTimeZone(value: string | null | undefined): value is PracticeTimeZone {
  return typeof value === "string" && SUPPORTED_TIME_ZONES.has(value);
}
