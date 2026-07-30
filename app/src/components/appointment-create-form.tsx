"use client";

import { useId, useMemo, useState } from "react";
import { AppointmentAlternativeSlots } from "@/components/appointment-alternative-slots";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ConflictDialog } from "@/components/conflict-dialog";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { DuplicatePatientDialog } from "@/components/duplicate-patient-dialog";
import { PatientSearchCombobox } from "@/components/patient-search-combobox";
import {
  CALENDAR_AVAILABILITY_WARNING_BYPASS_STORAGE_KEY,
  CALENDAR_CLOSURE_WARNING_BYPASS_STORAGE_KEY,
} from "@/lib/app-preferences";
import { APPOINTMENT_TITLES, DEFAULT_APPOINTMENT_TITLE } from "@/lib/client-enums";
import {
  addMinutesToDateTimeLocal,
  composeDateTimeLocal,
  splitDateTimeLocal,
} from "@/lib/appointments/datetime-input";
import {
  computeSchedulingWarning,
  type AvailabilityWindow,
  type DoctorTimeOff,
  type PracticeClosure,
  type PracticeWeeklyClosure,
} from "@/lib/scheduling-warnings";

type Props = {
  patients: { id: string; firstName: string; lastName: string; email?: string | null; phone?: string | null; taxId?: string | null }[];
  doctors: { id: string; fullName: string; specialty: string | null }[];
  serviceOptions: string[];
  availabilityWindows: AvailabilityWindow[];
  practiceClosures: PracticeClosure[];
  practiceWeeklyClosures: PracticeWeeklyClosure[];
  doctorTimeOffs?: DoctorTimeOff[];
  action: (formData: FormData) => Promise<void>;
  onSuccess?: () => void;
  initialStartsAt?: string;
  initialEndsAt?: string;
  initialDoctorId?: string;
  displayTimeZone?: string;
  returnTo?: string;
};

export function AppointmentCreateForm({
  patients,
  doctors,
  serviceOptions,
  availabilityWindows,
  practiceClosures,
  practiceWeeklyClosures,
  doctorTimeOffs = [],
  action,
  onSuccess,
  initialStartsAt,
  initialEndsAt,
  initialDoctorId,
  displayTimeZone,
  returnTo,
}: Props) {
  const formId = useId();
  const appointmentFormId = `appointment-create-form-${formId}`;
  const fieldClassName =
    "h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40";

  const sortedServiceOptions = useMemo(
    () => [...serviceOptions].sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" })),
    [serviceOptions]
  );

  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [localStartsAt, setLocalStartsAt] = useState(initialStartsAt ?? "");
  const [localEndsAt, setLocalEndsAt] = useState<string>(() => {
    if (initialEndsAt) return initialEndsAt;
    if (initialStartsAt) return addMinutesToDateTimeLocal(initialStartsAt, 60);
    return "";
  });
  const [doctorId, setDoctorId] = useState(initialDoctorId ?? "");
  const [findFirstToken, setFindFirstToken] = useState(0);
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId),
    [patients, selectedPatientId]
  );
  const [duplicatePatient, setDuplicatePatient] = useState<{ id: string; firstName: string; lastName: string; phone?: string | null } | null>(null);
  const [activeTab, setActiveTab] = useState<"schedule" | "details">("schedule");
  const [title, setTitle] = useState<string>(DEFAULT_APPOINTMENT_TITLE);
  const [serviceType, setServiceType] = useState<string>(() => sortedServiceOptions[0] ?? "");

  const visitDate = splitDateTimeLocal(localStartsAt).date;
  const startTime = splitDateTimeLocal(localStartsAt).time;
  const endTime = splitDateTimeLocal(localEndsAt).time;

  const updateVisitDate = (nextDate: string) => {
    if (!nextDate || !startTime || !endTime) return;
    setLocalStartsAt(composeDateTimeLocal(nextDate, startTime));
    setLocalEndsAt(composeDateTimeLocal(nextDate, endTime));
  };

  const updateStartTime = (nextTime: string) => {
    if (!visitDate || !nextTime) return;
    setLocalStartsAt(composeDateTimeLocal(visitDate, nextTime));
  };

  const updateEndTime = (nextTime: string) => {
    if (!visitDate || !nextTime) return;
    setLocalEndsAt(composeDateTimeLocal(visitDate, nextTime));
  };

  const setEndFromStart = (minutes: number) => {
    if (!localStartsAt) return;
    setLocalEndsAt(addMinutesToDateTimeLocal(localStartsAt, minutes));
  };

  const durationMinutes = useMemo(() => {
    const start = new Date(localStartsAt);
    const end = new Date(localEndsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 60;
    return Math.max(5, Math.round((end.getTime() - start.getTime()) / 60000));
  }, [localStartsAt, localEndsAt]);

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

    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (checking) return;

    const form = e.currentTarget;
    const formData = new FormData(form);
    
    // Validation
    if (!handleValidate(form)) return;

    const patientId = formData.get("patientId") as string;
    const title = formData.get("title") as string;
    const startsAt = formData.get("startsAt") as string;
    const endsAt = formData.get("endsAt") as string;
    const doctorId = formData.get("doctorId") as string || "";
    const ignoreClosureWarnings =
      window.localStorage.getItem(CALENDAR_CLOSURE_WARNING_BYPASS_STORAGE_KEY) === "true";
    const ignoreAvailabilityWarnings =
      window.localStorage.getItem(CALENDAR_AVAILABILITY_WARNING_BYPASS_STORAGE_KEY) === "true";

    if (!patientId || !title || !startsAt || !endsAt) {
      setError(
        !patientId
          ? "Seleziona un paziente nella scheda Dettagli prima di salvare."
          : "Dati mancanti: compila i campi obbligatori."
      );
      return;
    }

    setChecking(true);
    setError(null);
    setConflictMessage(null);

    // 1. Check for duplicates if it's a new patient
    if (isNewPatient && !form.dataset.confirmedDuplicate) {
      const firstName = formData.get("newFirstName") as string;
      const lastName = formData.get("newLastName") as string;
      const birthDate = formData.get("newBirthDate") as string;
      const phone = formData.get("newPhone") as string;
      const email = formData.get("newEmail") as string;
      const taxId = formData.get("newTaxId") as string;

      if (firstName && lastName && (birthDate || phone || email || taxId)) {
        try {
          const params = new URLSearchParams();
          params.set("firstName", firstName);
          params.set("lastName", lastName);
          if (birthDate) params.set("birthDate", birthDate);
          if (phone) params.set("phone", phone);
          if (email) params.set("email", email);
          if (taxId) params.set("taxId", taxId);

          const res = await fetch(`/api/patients/check-duplicate?${params.toString()}`);
          const data = await res.json();
          if (data.exists) {
            setDuplicatePatient(data.patient);
            setChecking(false);
            return;
          }
        } catch (err) {
          console.error("Duplicate check failed", err);
        }
      }
    }

    // 2. Check for scheduling warnings
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

    // 3. Perform action
    try {
      await action(formData);
      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof Error && err.message?.includes("NEXT_REDIRECT")) {
        onSuccess?.();
        return;
      }
      setError(err instanceof Error ? err.message : "Errore durante la creazione.");
    } finally {
      setChecking(false);
      delete form.dataset.confirmedDuplicate;
      delete form.dataset.confirmedWarning;
    }
  };

  return (
    <>
      <UnsavedChangesGuard formId={appointmentFormId} />
      <form
        onSubmit={handleSubmit}
        className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
        data-appointment-form="create"
        id={appointmentFormId}
      >
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      {displayTimeZone ? <input type="hidden" name="timeZone" value={displayTimeZone} /> : null}
      <input type="hidden" name="startsAt" value={localStartsAt} />
      <input type="hidden" name="endsAt" value={localEndsAt} />
      <input type="hidden" name="doctorId" value={doctorId} />

      <div className="col-span-full flex rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-900/60">
        <button
          type="button"
          onClick={() => setActiveTab("schedule")}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
            activeTab === "schedule"
              ? "bg-white text-emerald-800 shadow-sm dark:bg-zinc-950 dark:text-emerald-200"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          }`}
        >
          Orario
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

      <div className={activeTab === "schedule" ? "contents" : "hidden"}>
      <div className="col-span-full grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="flex min-w-0 flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
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

        <label className="flex min-w-0 flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
          <span className="font-bold text-rose-600 dark:text-rose-500">Giorno</span>
          <input
            type="date"
            value={visitDate}
            onChange={(event) => updateVisitDate(event.target.value)}
            className={fieldClassName}
          />
        </label>

        <button
          type="button"
          onClick={() => setFindFirstToken((token) => token + 1)}
          className="h-11 shrink-0 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Primo slot libero
        </button>
      </div>

      <div className="col-span-full grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="flex min-w-0 flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
          <span className="font-bold text-rose-600 dark:text-rose-500">Inizio visita</span>
          <input
            type="time"
            value={startTime}
            onChange={(event) => updateStartTime(event.target.value)}
            className={fieldClassName}
          />
        </label>

        <label className="flex min-w-0 flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
          <span className="font-bold text-rose-600 dark:text-rose-500">Fine visita</span>
          <input
            type="time"
            value={endTime}
            onChange={(event) => updateEndTime(event.target.value)}
            className={fieldClassName}
          />
        </label>

        <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:justify-end">
          <button
            type="button"
            className={`h-9 rounded-full border px-3 text-xs font-semibold transition ${
              durationMinutes > 45
                ? "border-violet-300 bg-violet-100 text-violet-900 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-100"
                : "border-zinc-200 text-zinc-700 hover:border-violet-300 hover:text-violet-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-violet-500 dark:hover:text-violet-300"
            }`}
            onClick={() => setEndFromStart(60)}
          >
            1H
          </button>
          <button
            type="button"
            className={`h-9 rounded-full border px-3 text-xs font-semibold transition ${
              durationMinutes > 20 && durationMinutes <= 45
                ? "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100"
                : "border-zinc-200 text-zinc-700 hover:border-emerald-300 hover:text-emerald-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
            }`}
            onClick={() => setEndFromStart(30)}
          >
            30m
          </button>
          <button
            type="button"
            className={`h-9 rounded-full border px-3 text-xs font-semibold transition ${
              durationMinutes <= 20
                ? "border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100"
                : "border-zinc-200 text-zinc-700 hover:border-sky-300 hover:text-sky-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-sky-500 dark:hover:text-sky-300"
            }`}
            onClick={() => setEndFromStart(15)}
          >
            15m
          </button>
        </div>
      </div>

      <AppointmentAlternativeSlots
        doctorId={doctorId}
        startsAt={localStartsAt}
        endsAt={localEndsAt}
        browseDate={visitDate}
        onBrowseDateChange={updateVisitDate}
        displayTimeZone={displayTimeZone}
        variant="inline"
        findFirstToken={findFirstToken}
        onSelectSlot={({ startsAt, endsAt }) => {
          setLocalStartsAt(startsAt);
          setLocalEndsAt(endsAt);
        }}
      />
      </div>

      <div className={activeTab === "details" ? "contents" : "hidden"}>
      <label className="flex min-w-0 flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200 sm:col-span-2">
        <span className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-rose-600 dark:text-rose-500">Paziente</span>
          {selectedPatient && (
            <span className="flex items-center gap-3 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
              {selectedPatient.phone && (
                <span className="flex items-center gap-1">
                  <svg className="h-3 w-3 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.79 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  {selectedPatient.phone}
                </span>
              )}
              {selectedPatient.taxId && (
                <span className="flex items-center gap-1">
                  <svg className="h-3 w-3 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="14" x="2" y="5" rx="2" />
                    <line x1="2" x2="22" y1="10" y2="10" />
                  </svg>
                  {selectedPatient.taxId}
                </span>
              )}
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
          placeholder="Cerca paziente..."
          allowNew
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
          onSelect={(id) => {
            setSelectedPatientId(id);
            const isNew = id === "new";
            setIsNewPatient(isNew);
            if (isNew) {
              setTitle(DEFAULT_APPOINTMENT_TITLE);
              setServiceType((prev) =>
                !prev
                  ? (serviceOptions.includes("Visita di controllo") ? "Visita di controllo" : serviceOptions[0] ?? "")
                  : prev
              );
            }
          }}
        />
      </label>
      {isNewPatient && (
        <div className="col-span-full grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm font-normal text-zinc-800 dark:text-zinc-200">
            <span className="font-bold text-rose-600 dark:text-rose-500">Nome</span>
            <input
              name="newFirstName"
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
              placeholder="Nome"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-normal text-zinc-800 dark:text-zinc-200">
            <span className="font-bold text-rose-600 dark:text-rose-500">Cognome</span>
            <input
              name="newLastName"
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
              placeholder="Cognome"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-normal text-zinc-800 dark:text-zinc-200">
            <span className="font-bold text-rose-600 dark:text-rose-500">Telefono</span>
            <input
              name="newPhone"
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
              placeholder="Telefono"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-normal text-zinc-800 dark:text-zinc-200">
            <span className="font-bold text-rose-600 dark:text-rose-500">Data di Nascita</span>
            <input
              name="newBirthDate"
              type="date"
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-normal text-zinc-800 dark:text-zinc-200 sm:col-span-2">
            <span className="font-bold">Email (facoltativa, consigliata per l&apos;accesso)</span>
            <input
              name="newEmail"
              type="email"
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
              placeholder="email@esempio.it"
            />
          </label>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
          <span className="font-bold text-rose-600 dark:text-rose-500">Tipo di appuntamento</span>
          <select
            name="title"
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
            value={title}
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
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
            name="titleCustom"
            placeholder="Specifica motivo..."
            required
            aria-label="Titolo personalizzato"
          />
        )}
        <span className="text-xs text-zinc-500 dark:text-zinc-400">Motivo della visita.</span>
      </div>
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
          <span className="font-bold text-rose-600 dark:text-rose-500">Servizio</span>
          <select
            name="serviceType"
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
            value={serviceType}
            required
            onChange={(e) => setServiceType(e.target.value)}
          >
            {sortedServiceOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value="altro">Altro</option>
          </select>
        </label>
        {serviceType === "altro" && (
          <input
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
            name="serviceTypeCustom"
            placeholder="Specifica servizio..."
            required
          />
        )}
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Scegli un servizio oppure inserisci un nome personalizzato.
        </span>
      </div>
      <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200 sm:col-span-2">
        <span className="font-bold">Note</span>
        <textarea
          name="notes"
          className="min-h-[44px] h-11 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
          placeholder="Note per il team"
        ></textarea>
      </label>
      </div>

      {activeTab === "schedule" && selectedPatientId ? (
        <input type="hidden" name="patientId" value={selectedPatientId} />
      ) : null}
      {activeTab === "schedule" ? (
        <>
          <input type="hidden" name="title" value={title === "altro" ? "altro" : title} />
          <input type="hidden" name="serviceType" value={serviceType} />
        </>
      ) : null}

      {error ? <p className="col-span-full text-sm text-rose-600 font-bold">{error}</p> : null}
      <div className="col-span-full">
        <FormSubmitButton
          disabled={checking}
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {checking ? "Operazione in corso..." : "Aggiungi appuntamento"}
        </FormSubmitButton>
      </div>
      {conflictMessage ? (
        <ConflictDialog 
          message={conflictMessage} 
          onClose={() => setConflictMessage(null)} 
          onProceed={() => {
            setConflictMessage(null);
            const form = document.getElementById(appointmentFormId) as HTMLFormElement;
            if (form) {
              form.dataset.confirmedWarning = "true";
              form.requestSubmit();
            }
          }}
        />
      ) : null}
      {duplicatePatient && (
        <DuplicatePatientDialog
          patient={duplicatePatient}
          onClose={() => setDuplicatePatient(null)}
          onProceed={() => {
            setDuplicatePatient(null);
            const form = document.getElementById(appointmentFormId) as HTMLFormElement;
            if (form) {
              form.dataset.confirmedDuplicate = "true";
              form.requestSubmit();
            }
          }}
        />
      )}
      </form>
    </>
  );
}
