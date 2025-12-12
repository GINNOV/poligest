"use client";

import { useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ConflictDialog } from "@/components/conflict-dialog";

type Option = { value: string; label: string };

type Props = {
  patients: { id: string; firstName: string; lastName: string }[];
  doctors: { id: string; fullName: string; specialty: string | null }[];
  serviceOptions: string[];
  action: (formData: FormData) => Promise<void>;
};

export function AppointmentCreateForm({ patients, doctors, serviceOptions, action }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [localEndsAt, setLocalEndsAt] = useState<string>("");
  const [allowSubmit, setAllowSubmit] = useState(false);
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [forcedTitle, setForcedTitle] = useState<string | null>(null);
  const [forcedService, setForcedService] = useState<string | null>(null);

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

  const formatLocalInput = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
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

        if (allowSubmit) {
          setAllowSubmit(false);
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

        setAllowSubmit(true);
        if (typeof form.requestSubmit === "function") {
          form.requestSubmit(submitter ?? undefined);
        } else {
          form.submit();
        }
      }}
    >
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
              setForcedTitle("Prima visita");
              setForcedService("Visita di controllo");
            } else {
              setForcedTitle(null);
              setForcedService(null);
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
            value={forcedTitle ?? undefined}
            defaultValue="Richiamo"
            required
            onChange={(e) => {
              if (!forcedTitle) {
                // only allow changes when not forced
                setForcedTitle(e.target.value);
              }
            }}
            disabled={Boolean(forcedTitle)}
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
            value={forcedService ?? undefined}
            defaultValue={serviceOptions[0] ?? ""}
            required
            onChange={(e) => {
              if (!forcedService) {
                setForcedService(e.target.value);
              }
            }}
            disabled={Boolean(forcedService)}
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
        Inizio
        <input
          className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          type="datetime-local"
          name="startsAt"
          onChange={(e) => {
            const value = e.target.value;
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
        Fine
        <input
          className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          type="datetime-local"
          name="endsAt"
          value={localEndsAt}
          onChange={(e) => setLocalEndsAt(e.target.value)}
          required
        />
        <span className="text-xs text-zinc-500">Proposta automatica +1h, puoi modificarla.</span>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
        Medico assegnato
        <select
          name="doctorId"
          className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          defaultValue=""
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
