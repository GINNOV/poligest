"use client";

import { useEffect, useMemo, useState } from "react";
import { AppointmentCreateForm } from "@/components/appointment-create-form";
import { AppointmentUpdateForm } from "@/components/appointment-update-form";
import { CALENDAR_COMPACT_PATIENT_NAME_STORAGE_KEY } from "@/lib/app-preferences";
import {
  buildPositionedAppointments,
  type CalendarAppointment,
} from "@/lib/calendar/layout-engine";

type AvailabilityWindow = {
  startMinute: number;
  endMinute: number;
  color: string;
  doctorId?: string;
};

type WeekDay = {
  date: string;
  label: string;
  isToday: boolean;
  isPracticeClosed?: boolean;
  isDoctorOnTimeOff?: boolean;
  availabilityWindows: AvailabilityWindow[];
  appointments: CalendarAppointment[];
};

const SERVICE_STYLES: Record<
  string,
  { bg: string; border: string; text: string; pill: string }
> = {
  "prima visita": {
    bg: "bg-sky-50 dark:bg-sky-950/35",
    border: "border-sky-200 dark:border-sky-800",
    text: "text-sky-900 dark:text-sky-100",
    pill: "bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-100",
  },
  "visita di controllo": {
    bg: "bg-emerald-50 dark:bg-emerald-950/35",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-900 dark:text-emerald-100",
    pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100",
  },
  urgenza: {
    bg: "bg-rose-50 dark:bg-rose-950/35",
    border: "border-rose-200 dark:border-rose-800",
    text: "text-rose-900 dark:text-rose-100",
    pill: "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-100",
  },
  richiamo: {
    bg: "bg-amber-50 dark:bg-amber-950/35",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-900 dark:text-amber-100",
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-100",
  },
  igiene: {
    bg: "bg-cyan-50 dark:bg-cyan-950/35",
    border: "border-cyan-200 dark:border-cyan-800",
    text: "text-cyan-900 dark:text-cyan-100",
    pill: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-100",
  },
  otturazione: {
    bg: "bg-indigo-50 dark:bg-indigo-950/35",
    border: "border-indigo-200 dark:border-indigo-800",
    text: "text-indigo-900 dark:text-indigo-100",
    pill: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-100",
  },
  devitalizzazione: {
    bg: "bg-violet-50 dark:bg-violet-950/35",
    border: "border-violet-200 dark:border-violet-800",
    text: "text-violet-900 dark:text-violet-100",
    pill: "bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-100",
  },
  estrazione: {
    bg: "bg-amber-50 dark:bg-amber-950/35",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-900 dark:text-amber-100",
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-100",
  },
  "estrazione chirurgica": {
    bg: "bg-red-50 dark:bg-red-950/35",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-900 dark:text-red-100",
    pill: "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-100",
  },
  "ablazione tartaro": {
    bg: "bg-teal-50 dark:bg-teal-950/35",
    border: "border-teal-200 dark:border-teal-800",
    text: "text-teal-900 dark:text-teal-100",
    pill: "bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-100",
  },
  implantologia: {
    bg: "bg-orange-50 dark:bg-orange-950/35",
    border: "border-orange-200 dark:border-orange-800",
    text: "text-orange-900 dark:text-orange-100",
    pill: "bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-100",
  },
  "protesi mobile": {
    bg: "bg-lime-50 dark:bg-lime-950/35",
    border: "border-lime-200 dark:border-lime-800",
    text: "text-lime-900 dark:text-lime-100",
    pill: "bg-lime-100 text-lime-800 dark:bg-lime-900/60 dark:text-lime-100",
  },
  "protesi fissa": {
    bg: "bg-yellow-50 dark:bg-yellow-950/35",
    border: "border-yellow-200 dark:border-yellow-800",
    text: "text-yellow-900 dark:text-yellow-100",
    pill: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-100",
  },
  altro: {
    bg: "bg-zinc-50 dark:bg-zinc-900",
    border: "border-zinc-200 dark:border-zinc-700",
    text: "text-zinc-900 dark:text-zinc-100",
    pill: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  },
};

function getServiceStyle(serviceType: string) {
  const key = (serviceType ?? "").toLowerCase().trim();
  return (
    SERVICE_STYLES[key] ?? {
      bg: "bg-zinc-50 dark:bg-zinc-900",
      border: "border-zinc-200 dark:border-zinc-700",
      text: "text-zinc-900 dark:text-zinc-100",
      pill: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
    }
  );
}

const HOUR_HEIGHT = 72;
const DEFAULT_DURATION_MINUTES = 60;
const CALENDAR_COMPACT_PATIENT_NAME_EVENT = "calendar-compact-patient-name-changed";

const padTime = (value: number) => value.toString().padStart(2, "0");

const toLocalInput = (date: string, minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${date}T${padTime(hours)}:${padTime(mins)}`;
};

type Props = {
  weekDays: WeekDay[];
  patients: { id: string; firstName: string; lastName: string; email?: string | null; phone?: string | null; taxId?: string | null }[];
  doctors: { id: string; fullName: string; specialty: string | null }[];
  serviceOptions: string[];
  services: { id: string; name: string }[];
  availabilityWindows: { doctorId: string; dayOfWeek: number; startMinute: number; endMinute: number }[];
  practiceClosures: { startsAt: string; endsAt: string; title?: string | null; type?: string }[];
  practiceWeeklyClosures: { dayOfWeek: number; title?: string | null }[];
  doctorTimeOffs: { doctorId: string; startsAt: string; endsAt: string; title?: string | null }[];
  action: (formData: FormData) => Promise<void>;
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  displayTimeZone: string;
  selectedDoctorId?: string;
  returnTo: string;
  searchQuery?: string;
  initialAppointmentId?: string;
};

export function CalendarWeekView({
  weekDays,
  patients,
  doctors,
  serviceOptions,
  services,
  availabilityWindows,
  practiceClosures,
  practiceWeeklyClosures,
  doctorTimeOffs,
  action,
  updateAction,
  deleteAction,
  displayTimeZone,
  selectedDoctorId,
  returnTo,
  searchQuery,
  initialAppointmentId,
}: Props) {
  const [selectedSlot, setSelectedSlot] = useState<{ startsAt: string; endsAt: string } | null>(
    null
  );
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarAppointment | null>(null);
  const [showPatientNameWhenCompact, setShowPatientNameWhenCompact] = useState(false);

  useEffect(() => {
    const readPreference = () => {
      setShowPatientNameWhenCompact(
        window.localStorage.getItem(CALENDAR_COMPACT_PATIENT_NAME_STORAGE_KEY) === "true"
      );
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === CALENDAR_COMPACT_PATIENT_NAME_STORAGE_KEY) {
        readPreference();
      }
    };
    readPreference();
    window.addEventListener("storage", handleStorage);
    window.addEventListener(CALENDAR_COMPACT_PATIENT_NAME_EVENT, readPreference);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(CALENDAR_COMPACT_PATIENT_NAME_EVENT, readPreference);
    };
  }, []);

  useEffect(() => {
    if (initialAppointmentId === "new") {
      const today = new Date();
      const todayKey = new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(today);
      setTimeout(() => {
        setSelectedSlot({
          startsAt: `${todayKey}T09:00`,
          endsAt: `${todayKey}T10:00`,
        });
        setSelectedAppointment(null);
      }, 0);
      return;
    }

    if (initialAppointmentId) {
      const found = weekDays.flatMap(d => d.appointments).find((a) => a.id === initialAppointmentId);
      if (found) {
        setTimeout(() => {
          setSelectedAppointment(found);
          // Scroll into view
          const el = document.querySelector(`[data-appt-id="${initialAppointmentId}"]`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 0);
      }
    }
  }, [initialAppointmentId, weekDays]);

  const filteredWeekDays = useMemo(() => {
    if (!searchQuery) return weekDays;
    const tokens = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return weekDays;

    return weekDays.map((day) => ({
      ...day,
      appointments: day.appointments.filter((appt) => {
        const name = appt.patientName.toLowerCase();
        const notes = (appt.notes || "").toLowerCase();
        return tokens.every((token) => name.includes(token) || notes.includes(token));
      }),
    }));
  }, [weekDays, searchQuery]);

  const { timeStartMinute, timeEndMinute } = useMemo(() => {
    let minMinute = 8 * 60;
    let maxMinute = 18 * 60;
    weekDays.forEach((day) => {
      day.availabilityWindows.forEach((win) => {
        minMinute = Math.min(minMinute, win.startMinute);
        maxMinute = Math.max(maxMinute, win.endMinute);
      });
      day.appointments.forEach((appt) => {
        minMinute = Math.min(minMinute, appt.hStart * 60 + appt.mStart);
        maxMinute = Math.max(maxMinute, appt.hEnd * 60 + appt.mEnd);
      });
    });
    const roundedStart = Math.max(0, Math.floor(minMinute / 60) * 60 - 60);
    const roundedEnd = Math.min(24 * 60, Math.ceil(maxMinute / 60) * 60 + 60);
    return {
      timeStartMinute: roundedStart,
      timeEndMinute: Math.max(roundedEnd, roundedStart + 60),
    };
  }, [weekDays]);

  const totalMinutes = timeEndMinute - timeStartMinute;
  const gridHeight = (totalMinutes / 60) * HOUR_HEIGHT;

  const hourMarks = useMemo(() => {
    const startHour = Math.floor(timeStartMinute / 60);
    const endHour = Math.ceil(timeEndMinute / 60);
    return Array.from({ length: endHour - startHour + 1 }).map((_, idx) => startHour + idx);
  }, [timeStartMinute, timeEndMinute]);

  const selectedLabelDate = selectedSlot?.startsAt ?? selectedAppointment?.startsAt ?? null;

  const [prevReturnTo, setPrevReturnTo] = useState(returnTo);
  if (returnTo !== prevReturnTo) {
    setPrevReturnTo(returnTo);
    setSelectedSlot(null);
    setSelectedAppointment(null);
  }

  useEffect(() => {
    if (!selectedSlot && !selectedAppointment) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc") {
        event.preventDefault();
        event.stopPropagation();
        setSelectedSlot(null);
        setSelectedAppointment(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedSlot, selectedAppointment]);

  return (
    <>
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[1080px]">
          <div className="grid grid-cols-[70px_repeat(7,minmax(140px,1fr))] gap-2 text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
            <div />
            {filteredWeekDays.map((day) => {
              return (
                <div key={day.date} className="flex items-center justify-between px-2">
                  <span
                    className={`rounded-full px-2 py-1 ${
                      day.isToday ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" : ""
                    }`}
                  >
                    {day.label}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-zinc-600 shadow-sm dark:bg-zinc-900 dark:text-zinc-300 dark:ring-1 dark:ring-zinc-700">
                    {day.appointments.length}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-2 grid grid-cols-[70px_repeat(7,minmax(140px,1fr))] gap-2">
            <div className="relative text-[10px] text-zinc-500 dark:text-zinc-400" style={{ height: gridHeight }}>
              {hourMarks.map((hour) => {
                const minutes = hour * 60;
                if (minutes < timeStartMinute || minutes > timeEndMinute) return null;
                const top = ((minutes - timeStartMinute) / 60) * HOUR_HEIGHT;
                return (
                  <div
                    key={hour}
                    className="absolute left-0 -translate-y-1/2 text-[10px] font-semibold"
                    style={{ top }}
                  >
                    {padTime(hour)}:00
                  </div>
                );
              })}
            </div>

            {filteredWeekDays.map((day) => {
              const positionedAppointments = buildPositionedAppointments(day.appointments);
              return (
                <div
                  key={day.date}
                  className="relative rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950"
                  style={{ height: gridHeight }}
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    if (day.isPracticeClosed) return;
                    const bounds = event.currentTarget.getBoundingClientRect();
                    const offsetY = Math.max(0, event.clientY - bounds.top);
                    const minutesFromStart = Math.min(totalMinutes, (offsetY / bounds.height) * totalMinutes);
                    const rounded = Math.round(minutesFromStart / 15) * 15;
                    const startsAtMinute = Math.min(timeEndMinute - 15, timeStartMinute + rounded);
                    const endsAtMinute = Math.min(timeEndMinute, startsAtMinute + DEFAULT_DURATION_MINUTES);
                    setSelectedAppointment(null);
                    setSelectedSlot({
                      startsAt: toLocalInput(day.date, startsAtMinute),
                      endsAt: toLocalInput(day.date, endsAtMinute),
                    });
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    if (day.isPracticeClosed) return;
                    setSelectedAppointment(null);
                    setSelectedSlot({
                      startsAt: toLocalInput(day.date, timeStartMinute),
                      endsAt: toLocalInput(day.date, Math.min(timeEndMinute, timeStartMinute + DEFAULT_DURATION_MINUTES)),
                    });
                  }}
                >
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white to-zinc-50/50 dark:from-zinc-950 dark:to-zinc-900/70" />
                  <div className="absolute inset-0">
                    {hourMarks.map((hour) => {
                      const minutes = hour * 60;
                      if (minutes < timeStartMinute || minutes > timeEndMinute) return null;
                      const top = ((minutes - timeStartMinute) / 60) * HOUR_HEIGHT;
                      return (
                        <div
                          key={`${day.date}-line-${hour}`}
                          className="absolute left-0 right-0 border-t border-zinc-200/70 dark:border-zinc-800"
                          style={{ top }}
                        />
                      );
                    })}
                  </div>

                  <div className="absolute inset-0">
                    {day.availabilityWindows.map((win, idx) => {
                      const startMinute = Math.max(win.startMinute, timeStartMinute);
                      const endMinute = Math.min(win.endMinute, timeEndMinute);
                      if (endMinute <= timeStartMinute || startMinute >= timeEndMinute) return null;
                      const top = ((startMinute - timeStartMinute) / 60) * HOUR_HEIGHT;
                      const height = ((endMinute - startMinute) / 60) * HOUR_HEIGHT;
                      const tint = `${win.color ?? "#10b981"}22`;
                      const border = `${win.color ?? "#10b981"}55`;
                      return (
                        <div
                          key={`${day.date}-avail-${idx}`}
                          className="absolute left-1 right-1 rounded-lg border"
                          style={{ top, height, backgroundColor: tint, borderColor: border }}
                        />
                      );
                    })}
                  </div>

                  <div className="absolute inset-0">
                    {positionedAppointments.map((appt) => {
                      const timeStr = `${padTime(appt.hStart)}:${padTime(appt.mStart)}`;
                      const startMinute = appt.startMinute;
                      const endMinute = appt.endMinute;
                      if (endMinute <= timeStartMinute || startMinute >= timeEndMinute) return null;
                      const clampedStart = Math.max(startMinute, timeStartMinute);
                      const clampedEnd = Math.min(endMinute, timeEndMinute);
                      const top = ((clampedStart - timeStartMinute) / 60) * HOUR_HEIGHT;
                      const slotHeight = ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT;
                      const height = Math.max(18, slotHeight - 1);
                      const styles = getServiceStyle(appt.serviceType);
                      const isCompact = height < 38;
                      const compactPrimaryLabel =
                        isCompact && showPatientNameWhenCompact ? appt.patientName : appt.serviceType;
                      const columnGap = 6;
                      const clickGutter = 8;
                      const columnWidth = 100 / appt.columnCount;
                      const left = `calc(${columnWidth * appt.columnIndex}% + ${columnGap / 2}px)`;
                      const width = `calc(${columnWidth}% - ${columnGap}px - ${clickGutter}px)`;
                      const gutterWidth = 4;
                      return (
                        <div
                          key={appt.id}
                          className="absolute z-10 group/appt"
                          data-appt-id={appt.id}
                          style={{ top, height, left, width: `calc(${width} + ${clickGutter}px)` }}
                        >
                          <div 
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-[60%] min-h-[10px] rounded-full bg-emerald-400 opacity-0 group-hover/appt:opacity-100 transition-opacity"
                          />
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedSlot(null);
                              setSelectedAppointment(appt);
                            }}
                            className={`absolute right-0 top-0 bottom-0 overflow-hidden rounded-lg border text-left text-[9px] shadow-sm transition hover:border-emerald-200 dark:hover:border-emerald-500 ${styles.bg} ${styles.border} ${styles.text} ${
                              isCompact ? "px-1.5 py-0.5" : "px-2 py-1"
                            }`}
                            style={{ left: gutterWidth, width: `calc(100% - ${gutterWidth}px)` }}
                          >
                            <div className="flex w-full items-center justify-between gap-2">
                              <span
                                className={`min-w-0 truncate rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${styles.pill}`}
                              >
                                {compactPrimaryLabel}
                              </span>
                              <span className="shrink-0 text-[9px] font-semibold text-zinc-600 dark:text-zinc-300">
                                {timeStr}
                              </span>
                            </div>
                            {!isCompact ? (
                              <div className="mt-1 truncate text-[10px] font-semibold">
                                {appt.patientName}
                              </div>
                            ) : null}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {day.isDoctorOnTimeOff ? (
                    <div className="pointer-events-none absolute inset-0 z-[1] rounded-xl bg-amber-50/75 ring-1 ring-inset ring-amber-200/80 dark:bg-amber-950/30 dark:ring-amber-900/60">
                      <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-amber-800 shadow-sm ring-1 ring-amber-200/70 dark:bg-zinc-950/85 dark:text-amber-200 dark:ring-amber-900/70">
                        FERIE
                      </div>
                    </div>
                  ) : day.isPracticeClosed ? (
                    <div className="pointer-events-none absolute inset-0 z-[1] rounded-xl bg-rose-50/70 ring-1 ring-inset ring-rose-200/70 dark:bg-rose-950/30 dark:ring-rose-900/60">
                      <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-rose-700 shadow-sm ring-1 ring-rose-200/70 dark:bg-zinc-950/85 dark:text-rose-200 dark:ring-rose-900/70">
                        CHIUSO
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedSlot || selectedAppointment ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedSlot(null);
              setSelectedAppointment(null);
            }
          }}
        >
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-950 dark:ring-1 dark:ring-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {selectedAppointment ? "Aggiorna appuntamento" : "Nuovo appuntamento"}
                </h3>
                {!selectedAppointment && selectedLabelDate ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {new Intl.DateTimeFormat("it-IT", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }).format(
                      selectedLabelDate.length > 10
                        ? new Date(selectedLabelDate)
                        : new Date(
                            Number(selectedLabelDate.slice(0, 4)),
                            Number(selectedLabelDate.slice(5, 7)) - 1,
                            Number(selectedLabelDate.slice(8, 10))
                          )
                    )}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedSlot(null);
                  setSelectedAppointment(null);
                }}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
              >
                Chiudi
              </button>
            </div>

            {selectedAppointment ? (
              <div className="space-y-3">
                <AppointmentUpdateForm
                  appointment={{
                    id: selectedAppointment.id,
                    title: selectedAppointment.title,
                    serviceType: selectedAppointment.serviceType,
                    startsAt: selectedAppointment.startsAt,
                    endsAt: selectedAppointment.endsAt,
                    patientId: selectedAppointment.patientId,
                    doctorId: selectedAppointment.doctorId,
                    status: selectedAppointment.status,
                    notes: selectedAppointment.notes ?? "",
                  }}
                  patients={patients}
                  doctors={doctors}
                  services={services}
                  availabilityWindows={availabilityWindows}
                  practiceClosures={practiceClosures}
                  practiceWeeklyClosures={practiceWeeklyClosures}
                  doctorTimeOffs={doctorTimeOffs}
                  action={updateAction}
                  displayTimeZone={displayTimeZone}
                  onSuccess={() => {
                    setSelectedAppointment(null);
                    setSelectedSlot(null);
                  }}
                  returnTo={returnTo}
                />
                <form
                  action={deleteAction}
                  className="flex justify-end"
                  data-confirm="Eliminare definitivamente questo appuntamento?"
                >
                  <input type="hidden" name="appointmentId" value={selectedAppointment.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button
                    type="submit"
                    className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-800 dark:text-rose-200 dark:hover:bg-rose-950/30"
                  >
                    Elimina appuntamento
                  </button>
                </form>
              </div>
            ) : (
              <AppointmentCreateForm
                patients={patients}
                doctors={doctors}
                serviceOptions={serviceOptions}
                availabilityWindows={availabilityWindows}
                practiceClosures={practiceClosures}
                practiceWeeklyClosures={practiceWeeklyClosures}
                doctorTimeOffs={doctorTimeOffs}
                action={action}
                displayTimeZone={displayTimeZone}
                onSuccess={() => {
                  setSelectedAppointment(null);
                  setSelectedSlot(null);
                }}
                initialStartsAt={selectedSlot?.startsAt}
                initialEndsAt={selectedSlot?.endsAt}
                initialDoctorId={selectedDoctorId}
                returnTo={returnTo}
              />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
