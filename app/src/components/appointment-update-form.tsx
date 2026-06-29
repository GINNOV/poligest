"use client";

import { useMemo, useState } from "react";
import { AppointmentAlternativeSlots } from "@/components/appointment-alternative-slots";
import { ConflictDialog } from "@/components/conflict-dialog";
import { PatientSearchCombobox } from "@/components/patient-search-combobox";
import {
  CALENDAR_AVAILABILITY_WARNING_BYPASS_STORAGE_KEY,
  CALENDAR_CLOSURE_WARNING_BYPASS_STORAGE_KEY,
} from "@/lib/app-preferences";
import { APPOINTMENT_TITLES, PREDEFINED_APPOINTMENT_TITLES } from "@/lib/client-enums";
import {
  addMinutesToDateTimeLocal,
  composeDateTimeLocal,
  formatAppointmentSlotSummary,
  splitDateTimeLocal,
} from "@/lib/appointments/datetime-input";
import {
  computeSchedulingWarning,
  type AvailabilityWindow,
  type DoctorTimeOff,
  type PracticeClosure,
  type PracticeWeeklyClosure,
} from "@/lib/scheduling-warnings";

type Person = { id: string; firstName: string; lastName: string; email?: string | null; phone?: string | null; taxId?: string | null };
type Doctor = { id: string; fullName: string; specialty: string | null };
type ServiceOption = { id: string; name: string };

type AppointmentUpdateFormProps = {
  appointment: {
    id: string;
    title: string;
    serviceType: string;
    startsAt: string;
    endsAt: string;
    patientId: string;
    doctorId: string | null;
    status: string;
    notes?: string | null;
  };
  patients: Person[];
  doctors: Doctor[];
  services: ServiceOption[];
  availabilityWindows: AvailabilityWindow[];
  practiceClosures: PracticeClosure[];
  practiceWeeklyClosures: PracticeWeeklyClosure[];
  doctorTimeOffs?: DoctorTimeOff[];
  action: (formData: FormData) => Promise<void>;
  onSuccess?: () => void;
  displayTimeZone?: string;
  returnTo?: string;
};

const fieldClassName =
  "h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40";

export function AppointmentUpdateForm({
  appointment,
  patients,
  doctors,
  services,
  availabilityWindows,
  practiceClosures,
  practiceWeeklyClosures,
  doctorTimeOffs = [],
  action,
  onSuccess,
  displayTimeZone,
  returnTo,
}: AppointmentUpdateFormProps) {
  const [activeTab, setActiveTab] = useState<"reschedule" | "details">("reschedule");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const sortedServices = useMemo(
    () =>
      [...services].sort((a, b) =>
        a.name.localeCompare(b.name, "it", { sensitivity: "base" })
      ),
    [services]
  );

  const [title, setTitle] = useState<string>(() => {
    return (PREDEFINED_APPOINTMENT_TITLES as readonly string[]).includes(appointment.title)
      ? appointment.title
      : "altro";
  });

  const [serviceType, setServiceType] = useState<string>(() => {
    const match = sortedServices.find((s) => s.name === appointment.serviceType);
    return match ? match.name : "altro";
  });

  const handleValidate = (form: HTMLFormElement) => {
    const startsAt = (form.elements.namedItem("startsAt") as HTMLInputElement | null)?.value;
    const endsAt = (form.elements.namedItem("endsAt") as HTMLInputElement | null)?.value;
    if (!startsAt || !endsAt) return true;
    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setError("Controlla il formato di data e ora.");
      return false;
    }
    if (endDate <= startDate) {
      setError("L'orario di fine deve essere successivo all'inizio.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (checking) return;

    const form = e.currentTarget;
    const formData = new FormData(form);

    if (!handleValidate(form)) return;

    const appointmentId = formData.get("appointmentId") as string;
    const patientId = formData.get("patientId") as string;
    const startsAt = formData.get("startsAt") as string;
    const endsAt = formData.get("endsAt") as string;
    const doctorId = (formData.get("doctorId") as string) || "";
    const ignoreClosureWarnings =
      window.localStorage.getItem(CALENDAR_CLOSURE_WARNING_BYPASS_STORAGE_KEY) === "true";
    const ignoreAvailabilityWarnings =
      window.localStorage.getItem(CALENDAR_AVAILABILITY_WARNING_BYPASS_STORAGE_KEY) === "true";

    if (!appointmentId || !patientId || !startsAt || !endsAt) {
      setError("Dati mancanti.");
      return;
    }

    setChecking(true);
    setError(null);
    setConflictMessage(null);

    if (!form.dataset.confirmedWarning) {
      const warning = computeSchedulingWarning({
        doctorId,
        startsAt,
        endsAt,
        availabilityWindows,
        practiceClosures,
        practiceWeeklyClosures,
        doctorTimeOffs,
        ignorePracticeClosureWarnings: ignoreClosureWarnings,
        ignoreDoctorAvailabilityWarnings: ignoreAvailabilityWarnings,
      });

      if (warning) {
        setConflictMessage(warning);
        setChecking(false);
        return;
      }
    }

    try {
      await action(formData);
      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof Error && err.message?.includes("NEXT_REDIRECT")) {
        onSuccess?.();
        return;
      }
      setError(err instanceof Error ? err.message : "Errore durante l'aggiornamento.");
    } finally {
      setChecking(false);
      delete form.dataset.confirmedWarning;
    }
  };

  const [selectedPatientId, setSelectedPatientId] = useState(appointment.patientId);
  const [startsAt, setStartsAt] = useState(appointment.startsAt);
  const [endsAt, setEndsAt] = useState(appointment.endsAt);
  const [doctorId, setDoctorId] = useState(appointment.doctorId ?? "");

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId),
    [patients, selectedPatientId]
  );

  const selectedDoctor = useMemo(
    () => doctors.find((doctor) => doctor.id === doctorId),
    [doctors, doctorId]
  );

  const originalSlotLabel = useMemo(
    () =>
      formatAppointmentSlotSummary(
        appointment.startsAt,
        appointment.endsAt,
        displayTimeZone ?? "Europe/Rome",
      ),
    [appointment.startsAt, appointment.endsAt, displayTimeZone]
  );

  const visitDate = splitDateTimeLocal(startsAt).date;
  const startTime = splitDateTimeLocal(startsAt).time;
  const endTime = splitDateTimeLocal(endsAt).time;

  const updateVisitDate = (nextDate: string) => {
    if (!nextDate || !startTime || !endTime) return;
    setStartsAt(composeDateTimeLocal(nextDate, startTime));
    setEndsAt(composeDateTimeLocal(nextDate, endTime));
  };

  const updateStartTime = (nextTime: string) => {
    if (!visitDate || !nextTime) return;
    setStartsAt(composeDateTimeLocal(visitDate, nextTime));
  };

  const updateEndTime = (nextTime: string) => {
    if (!visitDate || !nextTime) return;
    setEndsAt(composeDateTimeLocal(visitDate, nextTime));
  };

  const setEndFromStart = (minutes: number) => {
    if (!startsAt) return;
    setEndsAt(addMinutesToDateTimeLocal(startsAt, minutes));
  };

  return (
    <form
      className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
      id={`appointment-update-form-${appointment.id}`}
      onSubmit={handleSubmit}
    >
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      {displayTimeZone ? <input type="hidden" name="timeZone" value={displayTimeZone} /> : null}
      <input type="hidden" name="appointmentId" value={appointment.id} />
      <input type="hidden" name="doctorId" value={doctorId} />
      <input type="hidden" name="startsAt" value={startsAt} />
      <input type="hidden" name="endsAt" value={endsAt} />
      <input type="hidden" name="status" value={appointment.status} />

      <div className="col-span-full flex rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-900/60">
        <button
          type="button"
          onClick={() => setActiveTab("reschedule")}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
            activeTab === "reschedule"
              ? "bg-white text-emerald-800 shadow-sm dark:bg-zinc-950 dark:text-emerald-200"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          }`}
        >
          Sposta
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("details")}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
            activeTab === "details"
              ? "bg-white text-emerald-800 shadow-sm dark:bg-zinc-950 dark:text-emerald-200"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          }`}
        >
          Dettagli
        </button>
      </div>

      <div className={activeTab === "reschedule" ? "contents" : "hidden"}>
        <div className="col-span-full rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                {selectedPatient
                  ? `${selectedPatient.lastName} ${selectedPatient.firstName}`
                  : "Paziente"}
              </p>
              {selectedPatient?.phone ? (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{selectedPatient.phone}</p>
              ) : null}
            </div>
            <div className="text-right text-sm text-zinc-600 dark:text-zinc-300">
              <p className="font-medium text-zinc-800 dark:text-zinc-100">Attuale: {originalSlotLabel}</p>
              <p className="mt-1">
                {appointment.serviceType}
                {selectedDoctor ? ` · ${selectedDoctor.fullName}` : ""}
              </p>
            </div>
          </div>
        </div>

        <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200 sm:col-span-2">
          <span className="font-bold">Medico assegnato</span>
          <select
            value={doctorId}
            onChange={(event) => setDoctorId(event.target.value)}
            className={fieldClassName}
          >
            <option value="">—</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
          <span className="font-bold text-rose-600 dark:text-rose-500">Giorno</span>
          <input
            type="date"
            value={visitDate}
            onChange={(event) => updateVisitDate(event.target.value)}
            className={fieldClassName}
            required
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
          <span className="font-bold text-rose-600 dark:text-rose-500">Inizio visita</span>
          <input
            type="time"
            value={startTime}
            onChange={(event) => updateStartTime(event.target.value)}
            className={fieldClassName}
            required
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200 sm:col-span-2">
          <span className="font-bold text-rose-600 dark:text-rose-500">Fine visita</span>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <input
              type="time"
              value={endTime}
              onChange={(event) => updateEndTime(event.target.value)}
              className={`${fieldClassName} w-full sm:max-w-xs`}
              required
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="h-9 rounded-full border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
                onClick={() => setEndFromStart(60)}
              >
                1H
              </button>
              <button
                type="button"
                className="h-9 rounded-full border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
                onClick={() => setEndFromStart(30)}
              >
                30m
              </button>
              <button
                type="button"
                className="h-9 rounded-full border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
                onClick={() => setEndFromStart(15)}
              >
                15m
              </button>
            </div>
          </div>
        </label>

        <AppointmentAlternativeSlots
          appointmentId={appointment.id}
          doctorId={doctorId}
          startsAt={startsAt}
          endsAt={endsAt}
          displayTimeZone={displayTimeZone}
          variant="inline"
          onSelectSlot={({ startsAt: nextStartsAt, endsAt: nextEndsAt }) => {
            setStartsAt(nextStartsAt);
            setEndsAt(nextEndsAt);
          }}
        />
      </div>

      <div className={activeTab === "details" ? "contents" : "hidden"}>
        <label className="flex min-w-0 flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200 sm:col-span-2">
          <span className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-rose-600 dark:text-rose-500">Paziente</span>
            {selectedPatient && (
              <span className="flex items-center gap-3 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                {selectedPatient.phone && <span>{selectedPatient.phone}</span>}
                {selectedPatient.taxId && <span>{selectedPatient.taxId}</span>}
              </span>
            )}
          </span>
          <PatientSearchCombobox
            name="patientId"
            patients={patients.map((p) => ({
              id: p.id,
              fullName: `${p.lastName} ${p.firstName}`,
              phone: p.phone,
              taxId: p.taxId,
            }))}
            defaultValue={appointment.patientId}
            placeholder="Cerca paziente..."
            className={`${fieldClassName} w-full min-w-0`}
            onSelect={setSelectedPatientId}
          />
        </label>

        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
            <span className="font-bold text-rose-600 dark:text-rose-500">Tipo di appuntamento</span>
            <select
              name="title"
              value={title}
              className={fieldClassName}
              required
              onChange={(e) => setTitle(e.target.value)}
            >
              {APPOINTMENT_TITLES.map((option) => (
                <option key={option} value={option === "Altro" ? "altro" : option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          {title === "altro" && (
            <input
              className={fieldClassName}
              name="titleCustom"
              defaultValue={appointment.title}
              placeholder="Specifica motivo..."
              required
              aria-label="Titolo personalizzato"
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
            <span className="font-bold text-rose-600 dark:text-rose-500">Servizio</span>
            <select
              name="serviceType"
              value={serviceType}
              className={fieldClassName}
              required
              onChange={(e) => setServiceType(e.target.value)}
            >
              {sortedServices.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
              <option value="altro">Altro</option>
            </select>
          </label>
          {serviceType === "altro" && (
            <input
              className={fieldClassName}
              name="serviceTypeCustom"
              defaultValue={appointment.serviceType}
              placeholder="Specifica servizio..."
              required
            />
          )}
        </div>

        <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200 sm:col-span-2">
          <span className="font-bold">Note</span>
          <textarea
            name="notes"
            defaultValue={appointment.notes ?? ""}
            className="min-h-[88px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
            placeholder="Note per il team"
          ></textarea>
        </label>
      </div>

      {activeTab === "reschedule" ? (
        <input type="hidden" name="patientId" value={selectedPatientId} />
      ) : null}

      {error ? (
        <p className="col-span-full text-sm font-bold text-rose-600">{error}</p>
      ) : null}

      <div className="col-span-full">
        <button
          type="submit"
          disabled={checking}
          className="h-11 w-full rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {checking
            ? "Operazione in corso..."
            : activeTab === "reschedule"
              ? "Sposta appuntamento"
              : "Aggiorna appuntamento"}
        </button>
      </div>
      {conflictMessage ? (
        <ConflictDialog
          message={conflictMessage}
          onClose={() => setConflictMessage(null)}
          onProceed={() => {
            setConflictMessage(null);
            const form = document.getElementById(`appointment-update-form-${appointment.id}`) as HTMLFormElement;
            if (form) {
              form.dataset.confirmedWarning = "true";
              form.requestSubmit();
            }
          }}
        />
      ) : null}
    </form>
  );
}