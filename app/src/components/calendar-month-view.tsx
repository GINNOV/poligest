"use client";

import { useMemo, useState } from "react";
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
    bg: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-900",
    pill: "bg-sky-100 text-sky-800",
  },
  "visita di controllo": {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-900",
    pill: "bg-emerald-100 text-emerald-800",
  },
  urgenza: {
    bg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-900",
    pill: "bg-rose-100 text-rose-800",
  },
  richiamo: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-900",
    pill: "bg-amber-100 text-amber-800",
  },
  igiene: {
    bg: "bg-cyan-50",
    border: "border-cyan-200",
    text: "text-cyan-900",
    pill: "bg-cyan-100 text-cyan-800",
  },
  otturazione: {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-900",
    pill: "bg-indigo-100 text-indigo-800",
  },
  devitalizzazione: {
    bg: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-900",
    pill: "bg-violet-100 text-violet-800",
  },
  estrazione: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-900",
    pill: "bg-amber-100 text-amber-800",
  },
  "estrazione chirurgica": {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-900",
    pill: "bg-red-100 text-red-800",
  },
  "ablazione tartaro": {
    bg: "bg-teal-50",
    border: "border-teal-200",
    text: "text-teal-900",
    pill: "bg-teal-100 text-teal-800",
  },
  implantologia: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-900",
    pill: "bg-orange-100 text-orange-800",
  },
  "protesi mobile": {
    bg: "bg-lime-50",
    border: "border-lime-200",
    text: "text-lime-900",
    pill: "bg-lime-100 text-lime-800",
  },
  "protesi fissa": {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-900",
    pill: "bg-yellow-100 text-yellow-800",
  },
  altro: {
    bg: "bg-zinc-50",
    border: "border-zinc-200",
    text: "text-zinc-900",
    pill: "bg-zinc-100 text-zinc-700",
  },
};

function getServiceStyle(serviceType: string) {
  const key = (serviceType ?? "").toLowerCase().trim();
  return (
    SERVICE_STYLES[key] ?? {
      bg: "bg-zinc-50",
      border: "border-zinc-200",
      text: "text-zinc-900",
      pill: "bg-zinc-100 text-zinc-700",
    }
  );
}

type Props = {
  days: CalendarDay[];
  patients: { id: string; firstName: string; lastName: string }[];
  doctors: { id: string; fullName: string; specialty: string | null }[];
  serviceOptions: string[];
  services: { id: string; name: string }[];
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

  return (
    <>
      <div className="grid grid-cols-7 gap-2 text-[11px] font-semibold uppercase text-zinc-500">
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
            className={`flex min-h-[140px] flex-col rounded-xl border p-2 text-left transition ${
              day.inMonth
                ? day.isPracticeClosed
                  ? "cursor-pointer border-zinc-200 bg-zinc-100 hover:border-zinc-300"
                  : day.availabilityColors?.length
                    ? "cursor-pointer border-zinc-200 bg-white hover:border-emerald-200"
                    : "cursor-pointer border-zinc-200 bg-zinc-50 hover:border-zinc-300"
                : "cursor-default border-zinc-100 bg-zinc-50 text-zinc-400"
            }`}
          >
            {day.inMonth ? (
              <div className="mb-2 flex h-1 overflow-hidden rounded-full bg-zinc-200">
                {day.isPracticeClosed ? (
                  <div className="h-full flex-1 bg-zinc-400" />
                ) : day.availabilityColors && day.availabilityColors.length ? (
                  day.availabilityColors.map((color) => (
                    <div key={color} className="h-full flex-1" style={{ backgroundColor: color }} />
                  ))
                ) : (
                  <div className="h-full flex-1 bg-zinc-300" />
                )}
              </div>
            ) : null}
            <div className="flex items-center justify-between text-xs font-semibold">
              <span
                className={`h-6 w-6 rounded-full text-center leading-6 ${
                  day.isToday && day.inMonth ? "bg-emerald-100 text-emerald-800" : ""
                }`}
              >
                {day.label}
              </span>
              <div className="flex items-center gap-1">
                {day.isPracticeClosed && day.inMonth ? (
                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] text-zinc-700">
                    CHIUSO
                  </span>
                ) : !day.isPracticeClosed && day.inMonth && !day.availabilityColors?.length ? (
                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] text-zinc-700">
                    OFF
                  </span>
                ) : null}
                {day.appointments.length ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-800">
                    {day.appointments.length}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="mt-2 flex-1 space-y-1 overflow-y-auto">
              {day.appointments.length === 0 ? (
                <p className="text-[10px] text-zinc-400">Nessun appuntamento</p>
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
                    <button
                      type="button"
                      key={appt.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedDate(null);
                        setSelectedAppointment(appt);
                      }}
                      className={`w-full rounded-lg border px-2 py-1 text-left text-[10px] transition hover:border-emerald-200 ${styles.bg} ${styles.border} ${styles.text}`}
                    >
                      <div className="flex flex-wrap items-center gap-1">
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${styles.pill}`}>
                          {appt.serviceType}
                        </span>
                        <span className="text-[10px] font-semibold text-zinc-600">
                          {startTime} - {endTime}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-[11px] font-semibold">{appt.patientName}</div>
                    </button>
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
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">
                  {selectedAppointment ? "Aggiorna appuntamento" : "Nuovo appuntamento"}
                </h3>
                <p className="text-xs text-zinc-500">
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
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700"
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
                  }}
                  patients={patients}
                  doctors={doctors}
                  services={services}
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
                    className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50"
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
