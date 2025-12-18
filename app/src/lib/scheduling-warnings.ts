export type AvailabilityWindow = {
  doctorId: string;
  dayOfWeek: number; // 1=Mon ... 7=Sun
  startMinute: number;
  endMinute: number;
};

export type PracticeClosure = {
  startsAt: string; // ISO string
  endsAt: string; // ISO string
  title?: string | null;
  type?: string;
};

export type PracticeWeeklyClosure = {
  dayOfWeek: number; // 1=Mon ... 7=Sun
  title?: string | null;
};

const WEEKDAY_LABELS: Record<number, string> = {
  1: "Lunedì",
  2: "Martedì",
  3: "Mercoledì",
  4: "Giovedì",
  5: "Venerdì",
  6: "Sabato",
  7: "Domenica",
};

function weekdayIso(date: Date) {
  const jsDay = date.getDay(); // 0=Sun ... 6=Sat
  return jsDay === 0 ? 7 : jsDay;
}

function minutesFromDate(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

export function computeSchedulingWarning(params: {
  doctorId: string;
  startsAt: string;
  endsAt: string;
  availabilityWindows: AvailabilityWindow[];
  practiceClosures: PracticeClosure[];
  practiceWeeklyClosures?: PracticeWeeklyClosure[];
}): string | null {
  const { doctorId, startsAt, endsAt, availabilityWindows, practiceClosures, practiceWeeklyClosures } = params;
  if (!doctorId || !startsAt || !endsAt) return null;

  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const parts: string[] = [];

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  const day = weekdayIso(start);
  const dayLabel = WEEKDAY_LABELS[day] ?? "giorno selezionato";
  const startMin = minutesFromDate(start);
  const endMin = minutesFromDate(end);

  const doctorWindows = availabilityWindows.filter(
    (win) => win.doctorId === doctorId && win.dayOfWeek === day
  );
  const withinAnyWindow =
    sameDay &&
    doctorWindows.some((win) => startMin >= win.startMinute && endMin <= win.endMinute);

  if (!withinAnyWindow) {
    parts.push(
      `L'appuntamento è fuori dalla disponibilità del medico (${dayLabel}). Vuoi procedere comunque?`
    );
  }

  const weeklyMatch = (practiceWeeklyClosures ?? []).find((row) => row.dayOfWeek === day);
  if (weeklyMatch) {
    parts.push(
      `Lo studio risulta chiuso ogni ${dayLabel.toLowerCase()}${weeklyMatch.title ? ` (${weeklyMatch.title})` : ""}. Vuoi procedere comunque?`
    );
  }

  const overlappingClosures = practiceClosures.filter((closure) => {
    const cStart = new Date(closure.startsAt);
    const cEnd = new Date(closure.endsAt);
    if (Number.isNaN(cStart.getTime()) || Number.isNaN(cEnd.getTime())) return false;
    return intervalsOverlap(start, end, cStart, cEnd);
  });

  if (overlappingClosures.length) {
    const first = overlappingClosures[0];
    const title = first.title?.trim();
    parts.push(
      `Lo studio risulta chiuso in questo periodo${title ? ` (${title})` : ""}. Vuoi procedere comunque?`
    );
  }

  return parts.length ? parts.join(" ") : null;
}
