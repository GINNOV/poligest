import { parseDateTimeLocalInTimeZone } from "@/lib/time-zone";

export function splitDateTimeLocal(value: string) {
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

export function composeDateTimeLocal(date: string, time: string) {
  return `${date}T${time}`;
}

function calendarDate(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || year < 1900 || year > 2100) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** `yyyy-mm-dd` shown as `gg/mm/aaaa`. Returns "" when the value is not a calendar date. */
export function formatEuropeanDate(isoDate: string) {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const iso = calendarDate(Number(match[1]), Number(match[2]), Number(match[3]));
  if (!iso) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** Accepts `gg/mm/aaaa`, `gg-mm-aaaa`, `gg.mm.aaaa`, `ggmmaaaa`, or `aaaa-mm-gg`. */
export function parseEuropeanDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return calendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const local = trimmed.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (local) return calendarDate(Number(local[3]), Number(local[2]), Number(local[1]));

  const compact = trimmed.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (compact) return calendarDate(Number(compact[3]), Number(compact[2]), Number(compact[1]));

  return null;
}

/** `HH:mm` in 24-hour form. Returns "" when the value is not a time. */
export function formatEuropeanTime(value: string) {
  return parseEuropeanTime(value) ?? "";
}

/** Accepts `H:mm`, `HH:mm`, `HH.mm`, or `HHmm`. */
export function parseEuropeanTime(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const separated = trimmed.match(/^(\d{1,2})[:.](\d{1,2})$/);
  const compact = trimmed.match(/^(\d{2})(\d{2})$/);
  const match = separated ?? compact;
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  const pad = (part: number) => part.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}`;
}

export function addMinutesToDateTimeLocal(value: string, minutes: number) {
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return value;
  const end = new Date(start.getTime() + minutes * 60 * 1000);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(
    end.getHours(),
  )}:${pad(end.getMinutes())}`;
}

export function formatAppointmentSlotSummary(
  startsAtLocal: string,
  endsAtLocal: string,
  timeZone = "Europe/Rome",
) {
  const start = parseDateTimeLocalInTimeZone(startsAtLocal, timeZone);
  const end = parseDateTimeLocalInTimeZone(endsAtLocal, timeZone);
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return startsAtLocal;
  }

  const dateFormatter = new Intl.DateTimeFormat("it-IT", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeFormatter = new Intl.DateTimeFormat("it-IT", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${dateFormatter.format(start)} · ${timeFormatter.format(start)} – ${timeFormatter.format(end)}`;
}