"use client";

import { useId, useMemo, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ConflictDialog } from "@/components/conflict-dialog";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { DuplicatePatientDialog } from "@/components/duplicate-patient-dialog";
import { PatientSearchCombobox } from "@/components/patient-search-combobox";
import {
  computeSchedulingWarning,
  type AvailabilityWindow,
  type PracticeClosure,
  type PracticeWeeklyClosure,
} from "@/lib/scheduling-warnings";

type Props = {
  patients: { id: string; firstName: string; lastName: string; email?: string | null }[];
  doctors: { id: string; fullName: string; specialty: string | null }[];
  serviceOptions: string[];
  availabilityWindows: AvailabilityWindow[];
  practiceClosures: PracticeClosure[];
  practiceWeeklyClosures: PracticeWeeklyClosure[];
  action: (formData: FormData) => Promise<void>;
  onSuccess?: () => void;
  initialStartsAt?: string;
  initialEndsAt?: string;
  initialDoctorId?: string;
  returnTo?: string;
};

export function AppointmentCreateForm({
  patients,
  doctors,
  serviceOptions,
  availabilityWindows,
  practiceClosures,
  practiceWeeklyClosures,
  action,
  onSuccess,
  initialStartsAt,
  initialEndsAt,
  initialDoctorId,
  returnTo,
}: Props) {
  const formId = useId();
  const appointmentFormId = `appointment-create-form-${formId}`;
  const formatLocalInput = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  };

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
    if (initialStartsAt) {
      const start = new Date(initialStartsAt);
      if (!Number.isNaN(start.getTime())) {
        return formatLocalInput(new Date(start.getTime() + 60 * 60 * 1000));
      }
    }
    return "";
  });
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [duplicatePatient, setDuplicatePatient] = useState<{ id: string; firstName: string; lastName: string; phone?: string | null } | null>(null);
  const [title, setTitle] = useState<string>("Richiamo");
  const [serviceType, setServiceType] = useState<string>(() => sortedServiceOptions[0] ?? "");

  const setEndFromStart = (minutes: number) => {
    if (!localStartsAt) return;
    const start = new Date(localStartsAt);
    if (Number.isNaN(start.getTime())) return;
    const end = new Date(start.getTime() + minutes * 60 * 1000);
    setLocalEndsAt(formatLocalInput(end));
  };

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

  return (
    <>
      <UnsavedChangesGuard formId={appointmentFormId} />
      <form
      action={async (formData) => {
        setChecking(true);
        setError(null);
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
        }
      }}
      className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2"
      data-appointment-form="create"
      id={appointmentFormId}
      onSubmit={async (e) => {
        const form = e.currentTarget;
        const submitter = (e.nativeEvent as SubmitEvent).submitter as
          | HTMLButtonElement
          | HTMLInputElement
          | null;

        if (form.dataset.confirmedSubmit === "true") {
          return;
        }

        e.preventDefault();
        setError(null);
        setConflictMessage(null);

        if (!handleValidate(form)) return;

        const startsAt = (form.elements.namedItem("startsAt") as HTMLInputElement | null)?.value;
        const endsAt = (form.elements.namedItem("endsAt") as HTMLInputElement | null)?.value;
        const doctorId = (form.elements.namedItem("doctorId") as HTMLSelectElement | null)?.value || "";

        // Check for duplicates if it's a new patient
        if (isNewPatient) {
          const firstName = (form.elements.namedItem("newFirstName") as HTMLInputElement | null)?.value;
          const lastName = (form.elements.namedItem("newLastName") as HTMLInputElement | null)?.value;
          const phone = (form.elements.namedItem("newPhone") as HTMLInputElement | null)?.value;

          if (firstName || lastName || phone) {
            setChecking(true);
            try {
              const params = new URLSearchParams();
              if (firstName) params.set("firstName", firstName);
              if (lastName) params.set("lastName", lastName);
              if (phone) params.set("phone", phone);

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
            setChecking(false);
          }
        }

        const warning = computeSchedulingWarning({
          doctorId,
          startsAt: startsAt ?? "",
          endsAt: endsAt ?? "",
          availabilityWindows,
          practiceClosures,
          practiceWeeklyClosures,
        });

        if (warning) {
          if (submitter) {
            submitter.setAttribute("data-confirm", warning);
          } else {
            form.setAttribute("data-confirm", warning);
          }
          form.requestSubmit(submitter ?? undefined);
          return;
        } else {
          form.removeAttribute("data-confirm");
          submitter?.removeAttribute("data-confirm");
        }

        form.dataset.confirmedSubmit = "true";
        form.requestSubmit(submitter ?? undefined);
        // Do NOT delete confirmedSubmit immediately to avoid loops if requestSubmit is async
        setTimeout(() => {
          delete form.dataset.confirmedSubmit;
        }, 0);
      }}
      >
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200 sm:col-span-2">
        <span className="font-bold text-rose-600 dark:text-rose-500">Paziente</span>
        <PatientSearchCombobox
          name="patientId"
          patients={patients.map((p) => ({ id: p.id, fullName: `${p.lastName} ${p.firstName}` }))}
          placeholder="Cerca paziente..."
          allowNew
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
          onSelect={(id) => {
            const isNew = id === "new";
            setIsNewPatient(isNew);
            if (isNew) {
              setTitle("Prima visita");
              setServiceType(
                serviceOptions.includes("Visita di controllo")
                  ? "Visita di controllo"
                  : serviceOptions[0] ?? ""
              );
            } else if (id) {
              setTitle("Richiamo");
              setServiceType(serviceOptions[0] ?? "");
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
          <label className="flex flex-col gap-1 text-sm font-normal text-zinc-800 dark:text-zinc-200 sm:col-span-3">
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
      <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
        <span className="font-bold text-rose-600 dark:text-rose-500">Inizio visita</span>
        <input
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
          type="datetime-local"
          name="startsAt"
          value={localStartsAt}
          onChange={(e) => {
            const value = e.target.value;
            setLocalStartsAt(value);
            if (value) {
              const start = new Date(value);
              if (!Number.isNaN(start.getTime())) {
                const end = new Date(start.getTime() + 60 * 60 * 1000);
                setLocalEndsAt(formatLocalInput(end));
              }
            }
          }}
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
        <span className="font-bold text-rose-600 dark:text-rose-500">Stima di fine visita</span>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          <input
            className="h-11 flex-1 min-w-0 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
            type="datetime-local"
            name="endsAt"
            value={localEndsAt}
            onChange={(e) => setLocalEndsAt(e.target.value)}
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
      <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
        <span className="font-bold">Medico assegnato</span>
        <select
          name="doctorId"
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
          defaultValue={initialDoctorId ?? ""}
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
          className="min-h-[44px] h-11 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
          placeholder="Note per il team"
        ></textarea>
      </label>
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
        <ConflictDialog message={conflictMessage} onClose={() => setConflictMessage(null)} />
      ) : null}
      {duplicatePatient && (
        <DuplicatePatientDialog
          patient={duplicatePatient}
          onClose={() => setDuplicatePatient(null)}
          onProceed={() => {
            setDuplicatePatient(null);
            const form = document.getElementById(appointmentFormId) as HTMLFormElement;
            if (form) {
              form.dataset.confirmedSubmit = "true";
              const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
              submitBtn?.click();
              delete form.dataset.confirmedSubmit;
            }
          }}
        />
      )}
      </form>
    </>
  );
}
