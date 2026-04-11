import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { Gender, Role } from "@prisma/client";
import { ConsentModulePicker } from "@/components/consent-module-picker";
import { LocalizedFileInput } from "@/components/localized-file-input";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { ConfirmLeaveButton } from "@/components/confirm-leave-button";
import { PatientCreateSubmitButton } from "@/components/patient-create-submit-button";
import { createPatient } from "@/app/[locale]/(app)/pazienti/actions";
import { getAnamnesisConditions } from "@/lib/anamnesis";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { TaxIdBirthDateButton } from "@/components/taxid-birthdate-button";
import { PatientCreateRedirectField } from "@/components/patient-create-redirect-field";
import { PatientAnamnesisNotes } from "@/components/patient-anamnesis-notes";
import { PatientPaperConsentCheckbox } from "@/components/patient-paper-consent-checkbox";
import { Button } from "@/components/ui/button";

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
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Pazienti</p>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Registrazione paziente</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Compila per creare una nuova scheda paziente, includendo consenso e firma digitale.
          </p>
        </div>
        <Link
          href="/pazienti"
          className="inline-flex items-center rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-emerald-800 dark:hover:text-emerald-400"
        >
          Torna alla lista
        </Link>
      </div>

      <UnsavedChangesGuard formId="patient-create-form" />
      <form action={createPatient} className="space-y-6" id="patient-create-form">
        <PatientCreateRedirectField />
        <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Dati Personali</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Informazioni personali del paziente.</p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm font-medium text-rose-600 dark:text-rose-400">
              Cognome
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                name="lastName"
                required
                autoComplete="family-name"
                placeholder="Cognome"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-rose-600 dark:text-rose-400">
              Nome
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                name="firstName"
                required
                autoComplete="given-name"
                placeholder="Nome"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Indirizzo
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                name="address"
                autoComplete="street-address"
                placeholder="Via, Numero Civico"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Genere
              <select
                name="gender"
                defaultValue={Gender.NOT_SPECIFIED}
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
              >
                <option value={Gender.NOT_SPECIFIED}>Non specificato</option>
                <option value={Gender.FEMALE}>Femmina</option>
                <option value={Gender.MALE}>Maschio</option>
                <option value={Gender.OTHER}>Altro</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Città
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                name="city"
                autoComplete="address-level2"
                placeholder="Città"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-rose-600 dark:text-rose-400">
              Telefono
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                name="phone"
                autoComplete="tel"
                placeholder="Telefono"
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Email
              <input
                type="email"
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                name="email"
                autoComplete="email"
                placeholder="email@esempio.it"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              <span className="flex items-center justify-between gap-2">
                Codice Fiscale
                <TaxIdBirthDateButton />
              </span>
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 uppercase outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                name="taxId"
                placeholder="Codice Fiscale"
                maxLength={16}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Data di Nascita
              <input
                type="date"
                name="birthDate"
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                placeholder="dd/mm/yyyy"
              />
            </label>
            <div className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              <span>Foto (opzionale)</span>
              <LocalizedFileInput
                name="photo"
                accept="image/*"
                helperText="L'immagine verrà ridimensionata automaticamente a 512x512."
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Anamnesi Generale</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Seleziona eventuali condizioni mediche presenti o passate.
            </p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {conditionsList.map((condition, index) => (
              <label
                key={`${condition}-${index}`}
                className="inline-flex items-start gap-2 text-sm text-zinc-800 dark:text-zinc-200"
              >
                <input
                  type="checkbox"
                  name="conditions"
                  value={condition}
                  className="mt-1 h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900"
                />
                <span>{condition}</span>
              </label>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PatientAnamnesisNotes />
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Consenso e firma digitale</p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Leggi l&apos;informativa e acquisisci la firma digitale del paziente.
            </p>
          </div>
          <div className="mt-4">
            <ConsentModulePicker modules={consentModules} doctors={doctors} />
          </div>
          <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <PatientPaperConsentCheckbox />
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <PatientCreateSubmitButton
            label="Aggiungi nuovo paziente"
            className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-6 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
            pendingLabel="Salvataggio..."
          />
          <ConfirmLeaveButton
            formId="patient-create-form"
            href="/pazienti"
            label="Annulla"
            className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-emerald-800 dark:hover:text-emerald-400"
          />
        </div>
      </form>
    </div>
  );
}
