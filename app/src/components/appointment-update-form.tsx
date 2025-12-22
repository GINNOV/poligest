"use client";

import { useMemo, useState } from "react";
import { ConflictDialog } from "@/components/conflict-dialog";
import {
  computeSchedulingWarning,
  type AvailabilityWindow,
  type PracticeClosure,
  type PracticeWeeklyClosure,
} from "@/lib/scheduling-warnings";

type Person = { id: string; firstName: string; lastName: string; email?: string | null };
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
  };
  patients: Person[];
  doctors: Doctor[];
  services: ServiceOption[];
  availabilityWindows: AvailabilityWindow[];
  practiceClosures: PracticeClosure[];
  practiceWeeklyClosures: PracticeWeeklyClosure[];
  action: (formData: FormData) => Promise<void>;
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
  returnTo,
}: AppointmentUpdateFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [allowSubmit, setAllowSubmit] = useState(false);

  const originalStartsAt = useMemo(() => appointment.startsAt, [appointment.startsAt]);
  const originalEndsAt = useMemo(() => appointment.endsAt, [appointment.endsAt]);
  const originalDoctorId = useMemo(() => appointment.doctorId ?? "", [appointment.doctorId]);
  const originalStartMs = useMemo(() => new Date(appointment.startsAt).getTime(), [appointment.startsAt]);
  const originalEndMs = useMemo(() => new Date(appointment.endsAt).getTime(), [appointment.endsAt]);

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

  return (
    <form
      className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
      action={action}
      onSubmit={async (e) => {
        const form = e.currentTarget;
        const submitter = (e.nativeEvent as SubmitEvent).submitter as
          | HTMLButtonElement
          | HTMLInputElement
          | null;

        // If we already green-lit submission, let it flow through.
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

        const isUnchangedTime = (() => {
          if (doctorId !== originalDoctorId) return false;
          // Prefer string equality (exact same input values), fallback to millisecond comparison.
          if (startsAt === originalStartsAt && endsAt === originalEndsAt) return true;
          const startMs = new Date(startsAt ?? "").getTime();
          const endMs = new Date(endsAt ?? "").getTime();
          if (Number.isNaN(startMs) || Number.isNaN(endMs)) return false;
          return Math.abs(startMs - originalStartMs) < 1000 && Math.abs(endMs - originalEndMs) < 1000;
        })();

        if (doctorId && startsAt && endsAt && !isUnchangedTime) {
          setChecking(true);
          try {
            const params = new URLSearchParams({
              doctorId,
              startsAt,
              endsAt,
              excludeId: appointment.id,
            });
            const res = await fetch(`/api/appointments/check-conflict?${params.toString()}`, {
              credentials: "same-origin",
            });
            const data = res.ok ? await res.json() : { conflict: false };
            if (data?.conflict) {
              setConflictMessage(
                "Questo medico ha già un appuntamento in questo intervallo. Gli appuntamenti sovrapposti per lo stesso medico non sono consentiti. Modifica l'orario o il medico."
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

        // No conflicts: allow the native submit so the server action can redirect without errors.
        setAllowSubmit(true);
        form.requestSubmit(submitter ?? undefined);
      }}
    >
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <input type="hidden" name="appointmentId" value={appointment.id} />
      <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-700">
        Titolo
        <input
          name="title"
          defaultValue={appointment.title}
          className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-700">
        Servizio
        <div className="grid grid-cols-[2fr,1fr] gap-2">
          <select
            name="serviceType"
            defaultValue={
              services.find((s) => s.name === appointment.serviceType)?.name ?? services[0]?.name ?? ""
            }
            className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          >
            {services.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
            <option value="">Personalizzato</option>
          </select>
          <input
            name="serviceTypeCustom"
            defaultValue={
              services.find((s) => s.name === appointment.serviceType) ? "" : appointment.serviceType
            }
            className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            placeholder="Altro..."
          />
        </div>
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-700">
        Inizio
        <input
          type="datetime-local"
          name="startsAt"
          defaultValue={appointment.startsAt}
          className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-700">
        Fine
        <input
          type="datetime-local"
          name="endsAt"
          defaultValue={appointment.endsAt}
          className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-700">
        Paziente
        <select
          name="patientId"
          defaultValue={appointment.patientId}
          className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        >
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.lastName} {p.firstName}
              {p.email ? ` · ${p.email}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-700">
        Medico
        <select
          name="doctorId"
          defaultValue={appointment.doctorId ?? ""}
          className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        >
          <option value="">—</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.fullName} {d.specialty ? `· ${d.specialty}` : ""}
            </option>
          ))}
        </select>
      </label>
      <input type="hidden" name="status" value={appointment.status} />
      {error ? (
        <p className="col-span-full rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{error}</p>
      ) : null}
      <div className="col-span-full">
        <button
          type="submit"
        disabled={checking}
        className="h-10 w-full rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {checking ? "Controllo sovrapposizioni..." : "Aggiorna appuntamento"}
      </button>
    </div>
      {conflictMessage ? (
        <ConflictDialog message={conflictMessage} onClose={() => setConflictMessage(null)} />
      ) : null}
    </form>
  );
}
