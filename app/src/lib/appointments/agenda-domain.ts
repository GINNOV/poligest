import { AppointmentStatus } from "@prisma/client";

export const DEFAULT_AGENDA_APPOINTMENT_DURATION_MINUTES = 30;

export type AgendaDateRange = {
  gte: Date;
  lt: Date;
};

export type AgendaAppointmentSlot = {
  doctorId: string | null;
  startsAt: Date;
  endsAt: Date;
};

export function normalizeAgendaSearchValue(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : undefined;
}

export function parseAgendaPageNumber(pageParam: string | undefined) {
  const parsed = Number(pageParam);
  return Math.max(1, Number.isNaN(parsed) ? 1 : parsed);
}

export function parseAgendaDateRange(dateValue: string | undefined): AgendaDateRange | undefined {
  if (!dateValue) {
    return undefined;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) {
    return undefined;
  }

  const start = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { gte: start, lt: end };
}

export function adjustAppointmentEndsAt(
  startsAt: Date,
  endsAt: Date,
  fallbackMinutes = DEFAULT_AGENDA_APPOINTMENT_DURATION_MINUTES,
) {
  return endsAt <= startsAt ? new Date(startsAt.getTime() + fallbackMinutes * 60 * 1000) : endsAt;
}

export function isAppointmentStatus(value: string): value is AppointmentStatus {
  return Object.values(AppointmentStatus).includes(value as AppointmentStatus);
}

export function isSameAgendaAppointmentSlot(
  current: AgendaAppointmentSlot,
  next: AgendaAppointmentSlot,
) {
  return (
    current.doctorId === next.doctorId &&
    Math.abs(current.startsAt.getTime() - next.startsAt.getTime()) < 1000 &&
    Math.abs(current.endsAt.getTime() - next.endsAt.getTime()) < 1000
  );
}
