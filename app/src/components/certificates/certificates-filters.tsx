"use client";

import { PatientSearchCombobox } from "@/components/patient-search-combobox";
import { Button } from "@/components/ui/button";
import type { PatientSearchOption } from "@/lib/patient-search";

const comboboxClassName =
  "h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base font-semibold text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900";

export function CertificatesFilters({
  patients,
  patientId = "",
  type = "ALL",
}: {
  patients: PatientSearchOption[];
  patientId?: string;
  type?: string;
}) {
  return (
    <form action="/pazienti/certificati" className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <PatientSearchCombobox
          key={patientId || "empty"}
          name="patientId"
          patients={patients}
          defaultValue={patientId}
          placeholder="Cerca per cognome e nome"
          className={comboboxClassName}
        />
      </div>
      <select
        name="type"
        defaultValue={type}
        className="h-11 rounded-full border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-700 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
      >
        <option value="ALL">Tutte le tipologie</option>
        <option value="WORK_INCAPACITY">Riposo Lavorativo / Malattia</option>
        <option value="ATTENDANCE">Presenza Cure</option>
        <option value="INSURANCE">Assicurazione</option>
        <option value="CUSTOM">Personalizzato</option>
      </select>
      <Button type="submit" className="h-11 rounded-full px-5">
        Mostra certificati
      </Button>
    </form>
  );
}
