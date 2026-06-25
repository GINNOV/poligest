import { parseDateAtMidnightInTimeZone } from "@/lib/user-display-time-zone";

export type DoctorTimeOffRecord = {
  id: string;
  doctorId: string;
  title?: string | null;
  startsAt: string;
  endsAt: string;
};

function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

export function parseDoctorTimeOffDateRange(
  startDate: string,
  endDate: string,
  timeZone: string,
): { startsAt: Date; endsAt: Date } {
  const startMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate.trim());
  const endMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(endDate.trim());
  if (!startMatch || !endMatch) {
    throw new Error("Formato data non valido.");
  }

  const startsAt = parseDateAtMidnightInTimeZone(startDate.trim(), timeZone);
  const endDayStart = parseDateAtMidnightInTimeZone(endDate.trim(), timeZone);
  const endsAt = new Date(endDayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new Error("Formato data non valido.");
  }
  if (endsAt < startsAt) {
    throw new Error("La data di fine deve essere uguale o successiva alla data di inizio.");
  }

  return { startsAt, endsAt };
}

export function isDoctorTimeOffActive(
  doctorId: string | null | undefined,
  rangeStart: Date,
  rangeEnd: Date,
  timeOffs: DoctorTimeOffRecord[],
) {
  if (!doctorId) return false;

  return timeOffs.some((timeOff) => {
    if (timeOff.doctorId !== doctorId) return false;
    const offStart = new Date(timeOff.startsAt);
    const offEnd = new Date(timeOff.endsAt);
    if (Number.isNaN(offStart.getTime()) || Number.isNaN(offEnd.getTime())) return false;
    return intervalsOverlap(rangeStart, rangeEnd, offStart, offEnd);
  });
}

export function findDoctorTimeOffOverlap(
  doctorId: string,
  startsAt: Date,
  endsAt: Date,
  timeOffs: DoctorTimeOffRecord[],
) {
  return timeOffs.find((timeOff) => {
    if (timeOff.doctorId !== doctorId) return false;
    const offStart = new Date(timeOff.startsAt);
    const offEnd = new Date(timeOff.endsAt);
    if (Number.isNaN(offStart.getTime()) || Number.isNaN(offEnd.getTime())) return false;
    return intervalsOverlap(startsAt, endsAt, offStart, offEnd);
  });
}