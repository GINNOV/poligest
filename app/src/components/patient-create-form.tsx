"use client";

import { useTransition, useState } from "react";
import { Gender, type ConsentModule } from "@prisma/client";
import { ConsentModulePicker } from "@/components/consent-module-picker";
import { LocalizedFileInput } from "@/components/localized-file-input";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { ConfirmLeaveButton } from "@/components/confirm-leave-button";
import { PatientCreateSubmitButton } from "@/components/patient-create-submit-button";
import { TaxIdBirthDateButton } from "@/components/taxid-birthdate-button";
import { PatientCreateRedirectField } from "@/components/patient-create-redirect-field";
import { PatientAnamnesisNotes } from "@/components/patient-anamnesis-notes";
import { PatientPaperConsentCheckbox } from "@/components/patient-paper-consent-checkbox";
import { DuplicatePatientDialog } from "@/components/duplicate-patient-dialog";
import { emitToast } from "@/components/global-toasts";
import { isRedirectError } from "@/lib/utils";

type Props = {
  action: (formData: FormData) => Promise<void>;
  doctors: { id: string; fullName: string }[];
  consentModules: ConsentModule[];
  conditionsList: string[];
};

export function PatientCreateForm({
  action,
  doctors,
  consentModules,
  conditionsList,
}: Props) {
  const formId = "patient-create-form";
  const [duplicatePatient, setDuplicatePatient] = useState<{ id: string; firstName: string; lastName: string; phone?: string | null } | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const submitFormData = (formData: FormData) => {
    setIsSubmitting(true);
    startTransition(() => {
      void action(formData).catch((err) => {
        if (isRedirectError(err)) {
          return;
        }
        console.error("Patient creation failed", err);
        emitToast(err instanceof Error ? err.message : "Errore durante la creazione del paziente.", "error");
        setIsSubmitting(false);
      });
    });
  };

  const runDuplicateCheck = async (formData: FormData) => {
    try {
      const firstName = formData.get("firstName") as string;
      const lastName = formData.get("lastName") as string;
      const birthDate = formData.get("birthDate") as string;
      const phone = formData.get("phone") as string;
      const email = formData.get("email") as string;

      if (!firstName || !lastName) {
        return null;
      }

      const params = new URLSearchParams();
      params.set("firstName", firstName);
      params.set("lastName", lastName);
      if (birthDate) params.set("birthDate", birthDate);
      if (phone) params.set("phone", phone);
      if (email) params.set("email", email);

      const res = await fetch(`/api/patients/check-duplicate?${params.toString()}`);
      const data = await res.json();

      if (data.exists) {
        return data.patient;
      }
    } catch (err) {
      console.error("Duplicate check failed", err);
    } finally {
      setIsChecking(false);
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isChecking || isSubmitting) return;

    const form = e.currentTarget;
    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    setIsChecking(true);
    const duplicate = await runDuplicateCheck(formData);
    setIsChecking(false);
    if (duplicate) {
      setDuplicatePatient(duplicate);
      return;
    }

    submitFormData(formData);
  };

  return (
    <>
      <UnsavedChangesGuard formId={formId} />
      <form
        action={action}
        className="space-y-6"
        data-prevent-double-submit="false"
        id={formId}
        onSubmit={handleSubmit}
      >
        <PatientCreateRedirectField />
        <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Dati Personali</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Informazioni personali del paziente.</p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
              <span className="font-bold text-rose-600 dark:text-rose-400">Cognome</span>
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                name="lastName"
                required
                autoComplete="family-name"
                placeholder="Cognome"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
              <span className="font-bold text-rose-600 dark:text-rose-400">Nome</span>
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                name="firstName"
                required
                autoComplete="given-name"
                placeholder="Nome"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
              <span className="font-bold">Indirizzo</span>
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                name="address"
                autoComplete="street-address"
                placeholder="Via, Numero Civico"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
              <span className="font-bold">Genere</span>
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
            <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
              <span className="font-bold">Città</span>
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                name="city"
                autoComplete="address-level2"
                placeholder="Città"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
              <span className="font-bold text-rose-600 dark:text-rose-400">Telefono</span>
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                name="phone"
                autoComplete="tel"
                placeholder="Telefono"
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
              <span className="font-bold">Email</span>
              <input
                type="email"
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                name="email"
                autoComplete="email"
                placeholder="email@esempio.it"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
              <span className="flex items-center justify-between gap-2">
                <span className="font-bold">Codice Fiscale</span>
                <TaxIdBirthDateButton />
              </span>
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 uppercase outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                name="taxId"
                placeholder="Codice Fiscale"
                maxLength={16}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
              <span className="font-bold">Data di Nascita</span>
              <input
                type="date"
                name="birthDate"
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                placeholder="dd/mm/yyyy"
              />
            </label>
            <div className="flex flex-col gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
              <span className="font-bold">Foto (opzionale)</span>
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
            disabled={isChecking || isSubmitting || isPending}
          />
          <ConfirmLeaveButton
            formId={formId}
            href="/pazienti"
            label="Annulla"
            className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-emerald-800 dark:hover:text-emerald-400"
          />
        </div>
      </form>

      {duplicatePatient && (
        <DuplicatePatientDialog
          patient={duplicatePatient}
          onClose={() => setDuplicatePatient(null)}
          onProceed={() => {
            setDuplicatePatient(null);
            const form = document.getElementById(formId) as HTMLFormElement;
            if (form) {
              submitFormData(new FormData(form));
            }
          }}
        />
      )}
    </>
  );
}
