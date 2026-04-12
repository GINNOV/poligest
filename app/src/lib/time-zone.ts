import { DEFAULT_PRACTICE_TIME_ZONE } from "@/lib/practice-time-zone";

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
};

function getDateTimeParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const values = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));

  return {
    year: Number.parseInt(values.year ?? "0", 10),
    month: Number.parseInt(values.month ?? "1", 10),
    day: Number.parseInt(values.day ?? "1", 10),
    hour: Number.parseInt(values.hour ?? "0", 10),
    minute: Number.parseInt(values.minute ?? "0", 10),
    second: Number.parseInt(values.second ?? "0", 10),
  };
}

function getDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [year, month, day] = formatter
    .format(date)
    .split("-")
    .map((value) => Number.parseInt(value, 10));

  return { year, month, day };
}

function getTimeZoneOffset(date: Date, timeZone: string) {
  const values = getDateTimeParts(date, timeZone);
  const utcTimestamp = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  );

  return utcTimestamp - date.getTime();
}

function shiftCalendarDate(year: number, month: number, day: number, deltaDays: number) {
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
  };
}

export function toUtcForTimeZone(
  parts: ZonedDateParts,
  timeZone = DEFAULT_PRACTICE_TIME_ZONE,
) {
  const guess = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour ?? 0,
      parts.minute ?? 0,
      parts.second ?? 0,
    ),
  );
  const offset = getTimeZoneOffset(guess, timeZone);
  return new Date(guess.getTime() - offset);
}

export function addDaysInTimeZone(date: Date, days: number, timeZone = DEFAULT_PRACTICE_TIME_ZONE) {
  const parts = getDateParts(date, timeZone);
  const shifted = shiftCalendarDate(parts.year, parts.month, parts.day, days);
  return toUtcForTimeZone(shifted, timeZone);
}

export function setTimeOfDayInTimeZone(
  date: Date,
  timeOfDayMinutes: number,
  timeZone = DEFAULT_PRACTICE_TIME_ZONE,
) {
  const parts = getDateParts(date, timeZone);
  return toUtcForTimeZone(
    {
      ...parts,
      hour: Math.floor(timeOfDayMinutes / 60),
      minute: timeOfDayMinutes % 60,
      second: 0,
    },
    timeZone,
  );
}

export function formatDateInTimeZone(
  date: Date,
  options: Intl.DateTimeFormatOptions,
  timeZone = DEFAULT_PRACTICE_TIME_ZONE,
) {
  return new Intl.DateTimeFormat("it-IT", { ...options, timeZone }).format(date);
}

export function isSameTimeZoneDate(
  left: Date,
  right: Date,
  timeZone = DEFAULT_PRACTICE_TIME_ZONE,
) {
  const leftParts = getDateParts(left, timeZone);
  const rightParts = getDateParts(right, timeZone);
  return (
    leftParts.year === rightParts.year &&
    leftParts.month === rightParts.month &&
    leftParts.day === rightParts.day
  );
}

export function parseDateTimeLocalInTimeZone(
  value: string,
  timeZone = DEFAULT_PRACTICE_TIME_ZONE,
) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  return toUtcForTimeZone(
    {
      year: Number.parseInt(match[1] ?? "0", 10),
      month: Number.parseInt(match[2] ?? "1", 10),
      day: Number.parseInt(match[3] ?? "1", 10),
      hour: Number.parseInt(match[4] ?? "0", 10),
      minute: Number.parseInt(match[5] ?? "0", 10),
      second: Number.parseInt(match[6] ?? "0", 10),
    },
    timeZone,
  );
}
