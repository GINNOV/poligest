"use client";

import { useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ConflictDialog } from "@/components/conflict-dialog";
import {
  computeSchedulingWarning,
  type AvailabilityWindow,
  type PracticeClosure,
  type PracticeWeeklyClosure,
} from "@/lib/scheduling-warnings";

type Props = {
  patients: { id: string; firstName: string; lastName: string }[];
  doctors: { id: string; fullName: string; specialty: string | null }[];
  serviceOptions: string[];
  availabilityWindows: AvailabilityWindow[];
  practiceClosures: PracticeClosure[];
  practiceWeeklyClosures: PracticeWeeklyClosure[];
  action: (formData: FormData) => Promise<void>;
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
  initialStartsAt,
  initialEndsAt,
  initialDoctorId,
  returnTo,
}: Props) {
  const formatLocalInput = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  };

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
  const [allowSubmit, setAllowSubmit] = useState(false);
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [title, setTitle] = useState<string>("Richiamo");
  const [serviceType, setServiceType] = useState<string>(serviceOptions[0] ?? "");

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
    <form
      action={action}
      className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2"
      data-appointment-form="create"
      onSubmit={async (e) => {
        const form = e.currentTarget;
        const submitter = (e.nativeEvent as SubmitEvent).submitter as
          | HTMLButtonElement
          | HTMLInputElement
          | null;

        if (form.dataset.confirmedSubmit === "true") {
          form.removeAttribute("data-confirm");
          submitter?.removeAttribute("data-confirm");
          return;
        }

        if (allowSubmit) {
          setAllowSubmit(false);
          form.removeAttribute("data-confirm");
          submitter?.removeAttribute("data-confirm");
          return;
        }

        e.preventDefault();
        setError(null);
        setConflictMessage(null);

        if (!handleValidate(form)) return;

        const startsAt = (form.elements.namedItem("startsAt") as HTMLInputElement | null)?.value;
        const endsAt = (form.elements.namedItem("endsAt") as HTMLInputElement | null)?.value;
        const doctorId = (form.elements.namedItem("doctorId") as HTMLSelectElement | null)?.value || "";

        // Check conflicts for the selected doctor before submitting.
        if (doctorId && startsAt && endsAt) {
          setChecking(true);
          try {
            const params = new URLSearchParams({
              doctorId,
              startsAt,
              endsAt,
            });
            const res = await fetch(`/api/appointments/check-conflict?${params.toString()}`, {
              credentials: "same-origin",
            });
            const data = res.ok ? await res.json() : { conflict: false, message: "" };
            if (data?.conflict) {
              setConflictMessage(
                "Questo medico ha già un appuntamento in questo intervallo. Gli appuntamenti sovrapposti per lo stesso medico non sono consentiti. Modifica l'orario o il medico prima di salvare."
              );
              setError(
                "Sovrapposizione per il medico selezionato: scegli un altro orario o medico."
              );
              setChecking(false);
              return;
            }
          } catch (err) {
            console.error("Conflict check failed", err);
            setChecking(false);
            return;
          }
          setChecking(false);
        }

        // Re-enable the original submitter in case a guard disabled it.
        if (submitter) {
          submitter.dataset.submitting = "false";
          submitter.removeAttribute("aria-busy");
          submitter.classList.remove("pointer-events-none", "opacity-70");
          submitter.disabled = false;
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
          setChecking(false);
          if (typeof form.requestSubmit === "function") {
            form.requestSubmit(submitter ?? undefined);
          } else {
            form.submit();
          }
          return;
        } else {
          form.removeAttribute("data-confirm");
          submitter?.removeAttribute("data-confirm");
        }

        setAllowSubmit(true);
        if (typeof form.requestSubmit === "function") {
          form.requestSubmit(submitter ?? undefined);
        } else {
          form.submit();
        }
      }}
    >
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
        Paziente
        <select
          name="patientId"
          className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          required
          defaultValue=""
          onChange={(e) => {
            const isNew = e.target.value === "new";
            setIsNewPatient(isNew);
            if (isNew) {
              setTitle("Prima visita");
              setServiceType(
                serviceOptions.includes("Visita di controllo")
                  ? "Visita di controllo"
                  : serviceOptions[0] ?? ""
              );
            } else {
              setTitle("Richiamo");
              setServiceType(serviceOptions[0] ?? "");
            }
          }}
        >
          <option value="" disabled>
            Seleziona paziente
          </option>
          <option value="new">+ Nuovo cliente</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.lastName} {p.firstName}
            </option>
          ))}
        </select>
      </label>
      {isNewPatient && (
        <div className="col-span-full grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
            Nome
            <input
              name="newFirstName"
              className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              placeholder="Nome"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
            Cognome
            <input
              name="newLastName"
              className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              placeholder="Cognome"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
            Telefono
            <input
              name="newPhone"
              className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              placeholder="Telefono"
              required
            />
          </label>
        </div>
      )}
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
        Richiede visita per...
        <div className="grid grid-cols-[2fr,1fr] gap-2">
          <select
            name="title"
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            value={title}
            required
            onChange={(e) => setTitle(e.target.value)}
          >
            <option value="Richiamo">Richiamo</option>
            <option value="Prima visita">Prima visita</option>
            <option value="Visita di controllo">Visita di controllo</option>
            <option value="Urgenza">Urgenza</option>
          </select>
          <input
            className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            name="titleCustom"
            placeholder="Altro..."
            aria-label="Titolo personalizzato"
          />
        </div>
        <span className="text-xs text-zinc-500">Motivo della visita.</span>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
        Servizio
        <div className="grid grid-cols-[2fr,1fr] gap-2">
          <select
            name="serviceType"
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            value={serviceType}
            required
            onChange={(e) => setServiceType(e.target.value)}
          >
            {serviceOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value="">Personalizzato</option>
          </select>
          <input
            className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            name="serviceTypeCustom"
            placeholder="Altro..."
          />
        </div>
        <span className="text-xs text-zinc-500">
          Scegli un servizio oppure inserisci un nome personalizzato.
        </span>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
        Inizio visita
        <input
          className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
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
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
        Stima di fine visita
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          <input
            className="h-11 flex-1 min-w-0 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            type="datetime-local"
            name="endsAt"
            value={localEndsAt}
            onChange={(e) => setLocalEndsAt(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="h-9 rounded-full border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-700"
              onClick={() => setEndFromStart(60)}
            >
              1H
            </button>
            <button
              type="button"
              className="h-9 rounded-full border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-700"
              onClick={() => setEndFromStart(30)}
            >
              30m
            </button>
            <button
              type="button"
              className="h-9 rounded-full border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-700"
              onClick={() => setEndFromStart(15)}
            >
              15m
            </button>
          </div>
        </div>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
        Medico assegnato
        <select
          name="doctorId"
          className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          defaultValue={initialDoctorId ?? ""}
        >
          <option value="">—</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.fullName} {d.specialty ? `· ${d.specialty}` : ""}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="col-span-full text-sm text-rose-600">{error}</p> : null}
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
        Note (opzionali)
        <textarea
          name="notes"
          className="min-h-[80px] rounded-xl border border-zinc-200 px-3 py-2 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          placeholder="Note per il team o dettagli sul paziente/servizio"
        />
      </label>
      <div className="col-span-full">
        <FormSubmitButton
          disabled={checking}
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {checking ? "Controllo sovrapposizioni..." : "Aggiungi appuntamento"}
        </FormSubmitButton>
      </div>
      {conflictMessage ? (
        <ConflictDialog message={conflictMessage} onClose={() => setConflictMessage(null)} />
      ) : null}
    </form>
  );
}
