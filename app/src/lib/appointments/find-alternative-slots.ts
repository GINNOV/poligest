import { formatCalendarLocalInput } from "@/lib/calendar/domain";
import { parseDateAtMidnightInTimeZone, weekdayIsoInTimeZone } from "@/lib/user-display-time-zone";
import { parseDateTimeLocalInTimeZone } from "@/lib/time-zone";
import type {
  AvailabilityWindow,
  DoctorTimeOff,
  PracticeClosure,
  PracticeWeeklyClosure,
} from "@/lib/scheduling-warnings";

export type AppointmentBlock = {
  startsAt: Date;
  endsAt: Date;
};

export type AlternativeSlot = {
  startsAtLocal: string;
  endsAtLocal: string;
  label: string;
};

export type FindAlternativeSlotsInput = {
  date: string;
  durationMinutes: number;
  doctorId: string;
  timeZone: string;
  existingAppointments: AppointmentBlock[];
  availabilityWindows: AvailabilityWindow[];
  practiceClosures: PracticeClosure[];
  practiceWeeklyClosures?: PracticeWeeklyClosure[];
  doctorTimeOffs?: DoctorTimeOff[];
  slotStepMinutes?: number;
  maxResults?: number;
  fallbackStartMinute?: number;
  fallbackEndMinute?: number;
};

const DEFAULT_SLOT_STEP_MINUTES = 15;
const DEFAULT_MAX_RESULTS = 16;
const DEFAULT_FALLBACK_START_MINUTE = 8 * 60;
const DEFAULT_FALLBACK_END_MINUTE = 20 * 60;

function padTime(value: number) {
  return value.toString().padStart(2, "0");
}

function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

function minutesToDate(date: string, minutes: number, timeZone: string) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const localValue = `${date}T${padTime(hours)}:${padTime(mins)}`;
  const parsed = parseDateTimeLocalInTimeZone(localValue, timeZone);
  if (!parsed || Number.isNaN(parsed.getTime())) {
    throw new Error(`Orario non valido: ${localValue}`);
  }
  return parsed;
}

function formatSlotLabel(start: Date, end: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("it-IT", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function isDayBlocked(input: {
  date: string;
  timeZone: string;
  doctorId: string;
  practiceClosures: PracticeClosure[];
  practiceWeeklyClosures?: PracticeWeeklyClosure[];
  doctorTimeOffs?: DoctorTimeOff[];
}) {
  const dayStart = parseDateAtMidnightInTimeZone(input.date, input.timeZone);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const weekday = weekdayIsoInTimeZone(dayStart, input.timeZone);

  const weeklyClosure = (input.practiceWeeklyClosures ?? []).find(
    (row) => row.dayOfWeek === weekday,
  );
  if (weeklyClosure) {
    return "Lo studio è chiuso in questo giorno della settimana.";
  }

  const hasClosure = input.practiceClosures.some((closure) => {
    const closureStart = new Date(closure.startsAt);
    const closureEnd = new Date(closure.endsAt);
    if (Number.isNaN(closureStart.getTime()) || Number.isNaN(closureEnd.getTime())) {
      return false;
    }
    return intervalsOverlap(dayStart, dayEnd, closureStart, closureEnd);
  });
  if (hasClosure) {
    return "Lo studio risulta chiuso in questa data.";
  }

  const fullDayTimeOff = (input.doctorTimeOffs ?? []).some((timeOff) => {
    if (timeOff.doctorId !== input.doctorId) return false;
    const offStart = new Date(timeOff.startsAt);
    const offEnd = new Date(timeOff.endsAt);
    if (Number.isNaN(offStart.getTime()) || Number.isNaN(offEnd.getTime())) {
      return false;
    }
    return offStart <= dayStart && offEnd >= dayEnd;
  });
  if (fullDayTimeOff) {
    return "Il medico risulta assente per l'intera giornata.";
  }

  return null;
}

function getSearchWindows(input: FindAlternativeSlotsInput, weekday: number) {
  const doctorWindows = input.availabilityWindows.filter(
    (window) => window.doctorId === input.doctorId && window.dayOfWeek === weekday,
  );

  if (doctorWindows.length > 0) {
    return doctorWindows.map((window) => ({
      startMinute: window.startMinute,
      endMinute: window.endMinute,
    }));
  }

  return [
    {
      startMinute: input.fallbackStartMinute ?? DEFAULT_FALLBACK_START_MINUTE,
      endMinute: input.fallbackEndMinute ?? DEFAULT_FALLBACK_END_MINUTE,
    },
  ];
}

function isSlotBlocked(input: {
  slotStart: Date;
  slotEnd: Date;
  doctorId: string;
  practiceClosures: PracticeClosure[];
  doctorTimeOffs?: DoctorTimeOff[];
}) {
  const blockedByClosure = input.practiceClosures.some((closure) => {
    const closureStart = new Date(closure.startsAt);
    const closureEnd = new Date(closure.endsAt);
    if (Number.isNaN(closureStart.getTime()) || Number.isNaN(closureEnd.getTime())) {
      return false;
    }
    return intervalsOverlap(input.slotStart, input.slotEnd, closureStart, closureEnd);
  });
  if (blockedByClosure) return true;

  return (input.doctorTimeOffs ?? []).some((timeOff) => {
    if (timeOff.doctorId !== input.doctorId) return false;
    const offStart = new Date(timeOff.startsAt);
    const offEnd = new Date(timeOff.endsAt);
    if (Number.isNaN(offStart.getTime()) || Number.isNaN(offEnd.getTime())) {
      return false;
    }
    return intervalsOverlap(input.slotStart, input.slotEnd, offStart, offEnd);
  });
}

export function findAlternativeSlots(input: FindAlternativeSlotsInput): {
  slots: AlternativeSlot[];
  blockedReason?: string;
} {
  const durationMinutes = Math.max(5, Math.round(input.durationMinutes));
  const slotStepMinutes = input.slotStepMinutes ?? DEFAULT_SLOT_STEP_MINUTES;
  const maxResults = input.maxResults ?? DEFAULT_MAX_RESULTS;

  if (!input.doctorId) {
    return { slots: [], blockedReason: "Seleziona un medico per cercare slot liberi." };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { slots: [], blockedReason: "Data non valida." };
  }

  const dayStart = parseDateAtMidnightInTimeZone(input.date, input.timeZone);
  if (Number.isNaN(dayStart.getTime())) {
    return { slots: [], blockedReason: "Data non valida." };
  }

  const blockedReason = isDayBlocked({
    date: input.date,
    timeZone: input.timeZone,
    doctorId: input.doctorId,
    practiceClosures: input.practiceClosures,
    practiceWeeklyClosures: input.practiceWeeklyClosures,
    doctorTimeOffs: input.doctorTimeOffs,
  });
  if (blockedReason) {
    return { slots: [], blockedReason };
  }

  const weekday = weekdayIsoInTimeZone(dayStart, input.timeZone);
  const searchWindows = getSearchWindows(input, weekday);
  const now = new Date();
  const slots: AlternativeSlot[] = [];

  for (const window of searchWindows) {
    for (
      let startMinute = window.startMinute;
      startMinute + durationMinutes <= window.endMinute;
      startMinute += slotStepMinutes
    ) {
      const slotStart = minutesToDate(input.date, startMinute, input.timeZone);
      const slotEnd = minutesToDate(input.date, startMinute + durationMinutes, input.timeZone);

      if (slotStart < now) continue;

      if (
        isSlotBlocked({
          slotStart,
          slotEnd,
          doctorId: input.doctorId,
          practiceClosures: input.practiceClosures,
          doctorTimeOffs: input.doctorTimeOffs,
        })
      ) {
        continue;
      }

      const overlapsAppointment = input.existingAppointments.some((appointment) =>
        intervalsOverlap(slotStart, slotEnd, appointment.startsAt, appointment.endsAt),
      );
      if (overlapsAppointment) continue;

      slots.push({
        startsAtLocal: formatCalendarLocalInput(slotStart, input.timeZone),
        endsAtLocal: formatCalendarLocalInput(slotEnd, input.timeZone),
        label: formatSlotLabel(slotStart, slotEnd, input.timeZone),
      });

      if (slots.length >= maxResults) {
        return { slots };
      }
    }
  }

  return { slots };
}

export function computeAppointmentDurationMinutes(
  startsAtLocal: string,
  endsAtLocal: string,
  timeZone: string,
  fallbackMinutes = 30,
) {
  const startsAt = parseDateTimeLocalInTimeZone(startsAtLocal, timeZone);
  const endsAt = parseDateTimeLocalInTimeZone(endsAtLocal, timeZone);
  if (
    !startsAt ||
    !endsAt ||
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    endsAt <= startsAt
  ) {
    return fallbackMinutes;
  }

  return Math.max(5, Math.round((endsAt.getTime() - startsAt.getTime()) / 60000));
}