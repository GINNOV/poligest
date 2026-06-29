import { parseDateTimeLocalInTimeZone } from "@/lib/time-zone";

export function splitDateTimeLocal(value: string) {
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

export function composeDateTimeLocal(date: string, time: string) {
  return `${date}T${time}`;
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
  });
  return `${dateFormatter.format(start)} · ${timeFormatter.format(start)} – ${timeFormatter.format(end)}`;
}