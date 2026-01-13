import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { Role } from "@prisma/client";
import { ConsentModulePicker } from "@/components/consent-module-picker";
import { LocalizedFileInput } from "@/components/localized-file-input";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { ConfirmLeaveButton } from "@/components/confirm-leave-button";
import { createPatient } from "@/app/[locale]/(app)/pazienti/actions";
import { getAnamnesisConditions } from "@/lib/anamnesis";
import { ASSISTANT_ROLE } from "@/lib/roles";

export default async function NuovoPazientePage() {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  await requireFeatureAccess(user.role, "patients");

  const [doctors, consentModules, conditionsList] = await Promise.all([
    prisma.doctor.findMany({
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    prisma.consentModule.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    getAnamnesisConditions(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Pazienti</p>
          <h1 className="text-2xl font-semibold text-zinc-900">Registrazione paziente</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Compila per creare una nuova scheda paziente, includendo consenso e firma digitale.
          </p>
        </div>
        <Link
          href="/pazienti"
          className="inline-flex items-center rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700"
        >
          Torna alla lista
        </Link>
      </div>

      <UnsavedChangesGuard formId="patient-create-form" />
      <form action={createPatient} className="space-y-6" id="patient-create-form">
        <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-900">Dati Personali</p>
            <p className="text-xs text-zinc-500">Informazioni personali del paziente.</p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Cognome
              <input
                className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                name="lastName"
                required
                autoComplete="family-name"
                placeholder="Cognome"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Nome
              <input
                className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                name="firstName"
                required
                autoComplete="given-name"
                placeholder="Nome"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
              Indirizzo
              <input
                className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                name="address"
                autoComplete="street-address"
                placeholder="Via, Numero Civico"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Città
              <input
                className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                name="city"
                autoComplete="address-level2"
                placeholder="Città"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Telefono
              <input
                className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                name="phone"
                autoComplete="tel"
                placeholder="Telefono"
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Email
              <input
                type="email"
                className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                name="email"
                autoComplete="email"
                placeholder="email@esempio.it"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Codice Fiscale
              <input
                className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 uppercase outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                name="taxId"
                placeholder="Codice Fiscale"
                maxLength={16}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Data di Nascita
              <input
                type="date"
                name="birthDate"
                className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                placeholder="dd/mm/yyyy"
              />
            </label>
            <div className="flex flex-col gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
              <span>Foto (opzionale)</span>
              <LocalizedFileInput
                name="photo"
                accept="image/*"
                helperText="L'immagine verrà ridimensionata automaticamente a 512x512."
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-900">Anamnesi Generale</p>
            <p className="text-xs text-zinc-500">
              Seleziona eventuali condizioni mediche presenti o passate.
            </p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {conditionsList.map((condition, index) => (
              <label
                key={`${condition}-${index}`}
                className="inline-flex items-start gap-2 text-sm text-zinc-800"
              >
                <input
                  type="checkbox"
                  name="conditions"
                  value={condition}
                  className="mt-1 h-4 w-4 rounded border-zinc-300"
                />
                <span>{condition}</span>
              </label>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Specificare eventuali farmaci assunti regolarmente
              <textarea
                name="medications"
                className="min-h-[90px] rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                placeholder="Elenca farmaci e dosaggi"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Note aggiuntive
              <textarea
                name="extraNotes"
                className="min-h-[90px] rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                placeholder="Annotazioni utili per il medico"
              />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-900">Consenso e firma digitale</p>
            <p className="text-xs text-zinc-600">
              Leggi l'informativa e acquisisci la firma digitale del paziente.
            </p>
          </div>
          <div className="mt-4">
            <ConsentModulePicker modules={consentModules} doctors={doctors} />
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-6 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            Aggiorna nuovo paziente
          </button>
          <ConfirmLeaveButton
            formId="patient-create-form"
            href="/pazienti"
            label="Annulla"
            className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700"
          />
        </div>
      </form>
    </div>
  );
}