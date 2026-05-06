"use client";

import { useMemo, useState } from "react";
import { ConflictDialog } from "@/components/conflict-dialog";
import { PatientSearchCombobox } from "@/components/patient-search-combobox";
import {
  computeSchedulingWarning,
  type AvailabilityWindow,
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
  action: (formData: FormData) => Promise<void>;
  onSuccess?: () => void;
  displayTimeZone?: string;
  returnTo?: string;
};

export function AppointmentUpdateForm({
  appointment,
  patients,
  doctors,
  services,
  availabilityWindows,
  practiceClosures,
  practiceWeeklyClosures,
  action,
  onSuccess,
  displayTimeZone,
  returnTo,
}: AppointmentUpdateFormProps) {
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
    const knownTitles = ["Richiamo", "Prima visita", "Visita di controllo", "Urgenza"];
    return knownTitles.includes(appointment.title) ? appointment.title : "altro";
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
  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId),
    [patients, selectedPatientId]
  );

  return (
    <form
      className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
      id={`appointment-update-form-${appointment.id}`}
      onSubmit={handleSubmit}
    >
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      {displayTimeZone ? <input type="hidden" name="timeZone" value={displayTimeZone} /> : null}
      <input type="hidden" name="appointmentId" value={appointment.id} />
      
      <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200 sm:col-span-2">
        <span className="flex items-center justify-between gap-2">
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
          defaultValue={appointment.patientId}
          placeholder="Cerca paziente..."
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
          onSelect={setSelectedPatientId}
        />
      </label>

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
          <span className="font-bold text-rose-600 dark:text-rose-500">Tipo di appuntamento</span>
          <select
            name="title"
            value={title}
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
            required
            onChange={(e) => setTitle(e.target.value)}
          >
            <option value="Richiamo">Richiamo</option>
            <option value="Prima visita">Prima visita</option>
            <option value="Visita di controllo">Visita di controllo</option>
            <option value="Urgenza">Urgenza</option>
            <option value="altro">Altro</option>
          </select>
        </label>
        {title === "altro" && (
          <input
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
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
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
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
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
            name="serviceTypeCustom"
            defaultValue={appointment.serviceType}
            placeholder="Specifica servizio..."
            required
          />
        )}
      </div>

      <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
        <span className="font-bold text-rose-600 dark:text-rose-500">Inizio visita</span>
        <input
          type="datetime-local"
          name="startsAt"
          defaultValue={appointment.startsAt}
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
          required
        />
      </label>

      <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
        <span className="font-bold text-rose-600 dark:text-rose-500">Stima di fine visita</span>
        <input
          type="datetime-local"
          name="endsAt"
          defaultValue={appointment.endsAt}
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
          required
        />
      </label>

      <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
        <span className="font-bold">Medico assegnato</span>
        <select
          name="doctorId"
          defaultValue={appointment.doctorId ?? ""}
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
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
        <span className="font-bold">Note</span>
        <textarea
          name="notes"
          defaultValue={appointment.notes ?? ""}
          className="min-h-[44px] h-11 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
          placeholder="Note per il team"
        ></textarea>
      </label>

      <input type="hidden" name="status" value={appointment.status} />

      {error ? (
        <p className="col-span-full text-sm text-rose-600 font-bold">{error}</p>
      ) : null}

      <div className="col-span-full">
        <button
          type="submit"
          disabled={checking}
          className="h-11 w-full rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {checking ? "Operazione in corso..." : "Aggiorna appuntamento"}
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
