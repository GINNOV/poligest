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
      action={async (formData) => {
        const form = document.querySelector<HTMLFormElement>('form[data-appointment-form="create"]');
        if (!form || !handleValidate(form)) {
          return;
        }

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
              return;
            }
          } catch (err) {
            console.error("Conflict check failed", err);
          } finally {
            setChecking(false);
          }
        }

        try {
          await action(formData);
        } catch (err: any) {
          const message =
            err?.message ??
            "Impossibile creare l'appuntamento. Verifica i dati e riprova.";
          setError(message);
        }
      }}
      className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2"
      data-appointment-form="create"
      onSubmit={(e) => {
        if (!handleValidate(e.currentTarget)) {
          e.preventDefault();
        }
      }}
    >
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
        Appuntamento per...
        <div className="grid grid-cols-[2fr,1fr] gap-2">
          <select
            name="title"
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            defaultValue="Richiamo"
            required
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
        <span className="text-xs text-zinc-500">Scegli un titolo o inserisci uno personalizzato.</span>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
        Servizio
        <div className="grid grid-cols-[2fr,1fr] gap-2">
          <select
            name="serviceType"
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            defaultValue={serviceOptions[0] ?? ""}
            required
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
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
        Fine
        <input
          className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          type="datetime-local"
          name="endsAt"
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
        Paziente
        <select
          name="patientId"
          className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          required
          defaultValue=""
        >
          <option value="" disabled>
            Seleziona paziente
          </option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.lastName} {p.firstName}
            </option>
          ))}
        </select>
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
