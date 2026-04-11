"use client";

import { useEffect, useMemo, useState } from "react";
import { AppointmentCreateForm } from "@/components/appointment-create-form";
import { AppointmentUpdateForm } from "@/components/appointment-update-form";

type CalendarAppointment = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  serviceType: string;
  patientName: string;
  patientId: string;
  doctorId: string | null;
  status: string;
  notes?: string | null;
};

type CalendarDay = {
  date: string;
  label: string;
  inMonth: boolean;
  isToday: boolean;
  availabilityColors?: string[];
  isPracticeClosed?: boolean;
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

type Props = {
  days: CalendarDay[];
  patients: { id: string; firstName: string; lastName: string; email?: string | null }[];
  doctors: { id: string; fullName: string; specialty: string | null }[];
  serviceOptions: string[];
  services: { id: string; name: string }[];
  availabilityWindows: { doctorId: string; dayOfWeek: number; startMinute: number; endMinute: number }[];
  practiceClosures: { startsAt: string; endsAt: string; title?: string | null; type?: string }[];
  practiceWeeklyClosures: { dayOfWeek: number; title?: string | null }[];
  action: (formData: FormData) => Promise<void>;
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  selectedDoctorId?: string;
  returnTo: string;
};

const DEFAULT_START_TIME = "09:00";
const DEFAULT_END_TIME = "10:00";

export function CalendarMonthView({
  days,
  patients,
  doctors,
  serviceOptions,
  services,
  availabilityWindows,
  practiceClosures,
  practiceWeeklyClosures,
  action,
  updateAction,
  deleteAction,
  selectedDoctorId,
  returnTo,
}: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarAppointment | null>(null);

  const selectedStartsAt = useMemo(() => {
    if (!selectedDate) return undefined;
    return `${selectedDate}T${DEFAULT_START_TIME}`;
  }, [selectedDate]);

  const selectedEndsAt = useMemo(() => {
    if (!selectedDate) return undefined;
    return `${selectedDate}T${DEFAULT_END_TIME}`;
  }, [selectedDate]);

  const selectedLabelDate = selectedDate ?? selectedAppointment?.startsAt ?? null;

  useEffect(() => {
    if (!selectedDate && !selectedAppointment) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc") {
        event.preventDefault();
        event.stopPropagation();
        setSelectedDate(null);
        setSelectedAppointment(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedDate, selectedAppointment]);

  return (
    <>
      <div className="grid grid-cols-7 gap-2 text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
        {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((label) => (
          <div key={label} className="px-2">
            {label}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {days.map((day) => (
          <div
            key={day.date}
            role="button"
            tabIndex={day.inMonth ? 0 : -1}
            aria-disabled={!day.inMonth}
            onClick={() => {
              if (!day.inMonth) return;
              setSelectedAppointment(null);
              setSelectedDate(day.date);
            }}
            onKeyDown={(event) => {
              if (!day.inMonth) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelectedAppointment(null);
                setSelectedDate(day.date);
              }
            }}
            className={`group relative flex min-h-[140px] flex-col rounded-xl border p-2 text-left transition ${
              day.inMonth
                ? day.isPracticeClosed
                  ? "cursor-pointer border-zinc-200 bg-zinc-100 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
                  : day.availabilityColors?.length
                    ? "cursor-pointer border-emerald-200 bg-gradient-to-b from-white to-emerald-50/30 hover:border-emerald-300 hover:to-emerald-50/50 dark:border-emerald-900 dark:from-zinc-950 dark:to-emerald-950/20 dark:hover:border-emerald-700 dark:hover:to-emerald-950/35"
                    : "cursor-pointer border-zinc-200 bg-zinc-50 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-zinc-600"
                : "cursor-default border-zinc-100 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-500"
            }`}
          >
            {day.inMonth ? (
              <button
                type="button"
                className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white text-xs font-semibold text-zinc-600 opacity-0 pointer-events-none shadow-sm transition hover:border-emerald-200 hover:text-emerald-700 group-hover:pointer-events-auto group-hover:opacity-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-emerald-700 dark:hover:text-emerald-300"
                aria-label="Crea nuovo appuntamento"
                title="Nuovo appuntamento"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedAppointment(null);
                  setSelectedDate(day.date);
                }}
              >
                +
              </button>
            ) : null}
            {day.inMonth ? (
              <div className="mb-2 flex h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                {day.isPracticeClosed ? (
                  <div className="h-full flex-1 bg-zinc-400" />
                ) : day.availabilityColors && day.availabilityColors.length ? (
                  day.availabilityColors.map((color, idx) => (
                    <div
                      key={`${color}-${idx}`}
                      className="h-full flex-1"
                      style={{ backgroundColor: color }}
                    />
                  ))
                ) : (
                  <div className="h-full flex-1 bg-zinc-300 dark:bg-zinc-700" />
                )}
              </div>
            ) : null}
            <div className="flex items-center justify-between text-xs font-semibold">
              <span
                className={`h-6 w-6 rounded-full text-center leading-6 ${
                  day.isToday && day.inMonth ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" : ""
                }`}
              >
                {day.label}
              </span>
              <div className="flex items-center gap-1">
                {day.isPracticeClosed && day.inMonth ? (
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                    CHIUSO
                  </span>
                ) : !day.isPracticeClosed && day.inMonth && !day.availabilityColors?.length ? (
                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    Non Disp.
                  </span>
                ) : null}
                {day.appointments.length ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                    {day.appointments.length}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="mt-2 flex-1 space-y-1 overflow-y-auto pr-1">
              {day.appointments.length === 0 ? (
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500">Nessun appuntamento</p>
              ) : (
                day.appointments.map((appt) => {
                  const startTime = new Intl.DateTimeFormat("it-IT", {
                    timeStyle: "short",
                  }).format(new Date(appt.startsAt));
                  const endTime = new Intl.DateTimeFormat("it-IT", {
                    timeStyle: "short",
                  }).format(new Date(appt.endsAt));
                  const styles = getServiceStyle(appt.serviceType);
                  return (
                    <div key={appt.id} className="relative group/appt flex items-center gap-1.5">
                      <div className="w-1.5 h-6 rounded-full bg-emerald-400 opacity-0 group-hover/appt:opacity-100 transition-opacity shrink-0" />
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedDate(null);
                          setSelectedAppointment(appt);
                        }}
                        className={`flex-1 rounded-lg border px-2 py-1 text-left text-[10px] transition hover:border-emerald-200 dark:hover:border-emerald-500 ${styles.bg} ${styles.border} ${styles.text}`}
                      >
                      <div className="flex flex-wrap items-center gap-1">
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${styles.pill}`}>
                          {appt.serviceType}
                        </span>
                        <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">
                          {startTime} - {endTime}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-[11px] font-semibold">{appt.patientName}</div>
                    </button>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedDate || selectedAppointment ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedDate(null);
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
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {selectedLabelDate
                    ? new Intl.DateTimeFormat("it-IT", {
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
                      )
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(null);
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
                action={updateAction}
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
                action={action}
                initialStartsAt={selectedStartsAt}
                initialEndsAt={selectedEndsAt}
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
