import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatAuditActor } from "@/lib/audit";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const patient = await prisma.patient.findUnique({
    where: { id: resolvedParams.id },
    select: { firstName: true, lastName: true },
  });

  if (!patient) return { title: "Paziente non trovato" };

  return {
    title: `PAZIENTE: ${patient.lastName} ${patient.firstName}`,
  };
}
import { getRoleFeatureAccess, requireFeatureAccess } from "@/lib/feature-access";
import { Role, AppointmentStatus, Gender } from "@prisma/client";
import { FormSubmitButton } from "@/components/form-submit-button";
import { PatientAvatar } from "@/components/patient-avatar";
import { PatientPhotoDialog } from "@/components/patient-photo-dialog";
import { DentalChart } from "@/components/dental-chart";
import { PatientAnamnesisNotes } from "@/components/patient-anamnesis-notes";
import { ConsentForm } from "@/components/consent-form";
import { PatientPaperConsentToggle } from "@/components/patient-paper-consent-toggle";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { PageToastTrigger } from "@/components/page-toast-trigger";
import { PatientDeleteButton } from "@/components/patient-delete-button";
import {
  PatientImplantAssociations,
  type ImplantProductOption,
  type PatientImplantAssociationItem,
} from "@/components/patient-implant-associations";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { PrintLinkButton } from "@/components/print-link-button";
import {
  addImplantAssociationAction,
  resetPhotoAction,
  revokeConsentAction,
  sendPatientAccessEmailAction,
  sendPatientSmsAction,
  updateImplantAssociationAction,
  updatePatientAction,
  uploadPhotoAction,
} from "@/lib/patients/actions";
import { getPatientDetailPageData } from "@/lib/patients/page-data";
import { getUserDisplayTimeZone } from "@/lib/user-display-time-zone.server";
import { formatDateInDisplayTimeZone } from "@/lib/user-display-time-zone";
import { formatOptionalDateInputValue } from "@/lib/date";

const consentStatusLabels: Record<string, string> = {
  GRANTED: "Concesso",
  REVOKED: "Revocato",
  EXPIRED: "Scaduto",
};

const statusLabels: Record<AppointmentStatus, string> = {
  TO_CONFIRM: "Da confermare",
  CONFIRMED: "Confermato",
  IN_WAITING: "In attesa",
  IN_PROGRESS: "In corso",
  COMPLETED: "Completato",
  CANCELLED: "Annullato",
  NO_SHOW: "No-show",
};

const statusClasses: Record<AppointmentStatus, string> = {
  TO_CONFIRM: "border-amber-200 bg-amber-50 text-amber-800 shadow-sm dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200",
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-200",
  IN_WAITING: "border-zinc-200 bg-zinc-50 text-zinc-700 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/20 dark:text-zinc-300",
  IN_PROGRESS: "border-sky-200 bg-sky-50 text-sky-800 shadow-sm dark:border-sky-800/60 dark:bg-sky-900/20 dark:text-sky-200",
  COMPLETED: "border-teal-200 bg-teal-50 text-teal-800 shadow-sm dark:border-teal-800/60 dark:bg-teal-900/20 dark:text-teal-200",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-800 shadow-sm dark:border-rose-800/60 dark:bg-rose-900/20 dark:text-rose-200",
  NO_SHOW: "border-violet-200 bg-violet-50 text-violet-700 shadow-sm dark:border-violet-800/60 dark:bg-violet-900/20 dark:text-violet-300",
};

const formatDateTime = (value: Date | string | null | undefined, timeZone: string) => {
  if (!value) return "—";
  return formatDateInDisplayTimeZone(
    new Date(value),
    {
      dateStyle: "short",
      timeStyle: "short",
    },
    timeZone
  );
};

export default async function PatientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id?: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  await requireFeatureAccess(user.role, "patients");
  const featureAccess = await getRoleFeatureAccess(user.role);
  const canViewClinicalRecords = featureAccess.isAllowed("clinical-records");
  const isAdmin = user.role === Role.ADMIN;
  const canExport = isAdmin || user.role === Role.MANAGER;
  const displayTimeZone = await getUserDisplayTimeZone();

  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const patientId = resolvedParams?.id;
  if (!patientId) {
    return notFound();
  }
  const smsErrorMessage =
    typeof resolvedSearchParams.smsError === "string" ? resolvedSearchParams.smsError : null;
  const smsSuccessMessage =
    typeof resolvedSearchParams.smsSuccess === "string" ? resolvedSearchParams.smsSuccess : null;
  const accessErrorMessage =
    typeof resolvedSearchParams.accessError === "string" ? resolvedSearchParams.accessError : null;
  const accessSuccessMessage =
    typeof resolvedSearchParams.accessSuccess === "string" ? resolvedSearchParams.accessSuccess : null;
  const consentErrorMessage =
    typeof resolvedSearchParams.consentError === "string"
      ? resolvedSearchParams.consentError
      : null;
  const consentSuccessMessage =
    typeof resolvedSearchParams.consentSuccess === "string"
      ? resolvedSearchParams.consentSuccess
      : null;
  const openContactPanel =
    typeof resolvedSearchParams.openContact === "string" &&
    resolvedSearchParams.openContact === "1";

  const {
    doctors,
    patient,
    consentModules,
    conditionsList,
    patientPin,
    patientPhone,
    whatsappHref,
    hasConsents,
    parsedAddress,
    parsedCity,
    parsedTaxId,
    parsedConditions,
    parsedMedications,
    parsedExtra,
    products,
    implants,
    dentalRecordsSerialized,
    services,
    pastAppointments,
    missingRequired,
    visibleSmsTemplates,
    smsLogs,
    lastAccessEmailLog,
    lastWhatsappLog,
    createdLog,
    updatedLog,
  } = await getPatientDetailPageData(patientId);

  if (!patient) {
    return (
      <div className="order-2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Paziente non trovato.</p>
        <Link
          href="/pazienti"
          className="mt-4 inline-flex rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-emerald-800 dark:border-zinc-800 dark:text-emerald-200"
        >
          Torna a Pazienti
        </Link>
      </div>
    );
  }

  const activeConsents = patient.consents.filter((consent) => consent.status === "GRANTED");
  const createdBy = formatAuditActor(createdLog);
  const updatedBy = updatedLog ? formatAuditActor(updatedLog) : createdBy;
  const createdAtLabel = formatDateTime(createdLog?.createdAt ?? patient.createdAt, displayTimeZone);
  const updatedAtLabel = formatDateTime(updatedLog?.createdAt ?? patient.updatedAt, displayTimeZone);
  const implantProductOptions: ImplantProductOption[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku ?? null,
    brand: product.brand ?? null,
    supplierName: product.supplier?.name ?? null,
    udiDi: product.udiDi ?? null,
    udiPi: product.udiPi ?? null,
    serviceType: product.serviceType ?? null,
  }));
  const implantAssociationItems: PatientImplantAssociationItem[] = implants.map((implant) => ({
    id: implant.id,
    productId: implant.productId,
    productName: implant.product?.name ?? "—",
    brand: implant.product?.brand ?? null,
    supplierName: implant.product?.supplier?.name ?? null,
    udiDi: implant.product?.udiDi ?? null,
    udiPi: implant.udiPi ?? implant.product?.udiPi ?? null,
    purchaseDate: formatOptionalDateInputValue(implant.purchaseDate),
    interventionDate: formatOptionalDateInputValue(implant.interventionDate),
    interventionSite: implant.interventionSite ?? null,
  }));

  return (
    <>
      <PageToastTrigger
        messages={[
          { key: "smsSuccess", message: smsSuccessMessage ?? "", variant: "success" },
          { key: "accessSuccess", message: accessSuccessMessage ?? "", variant: "success" },
          { key: "consentSuccess", message: consentSuccessMessage ?? "", variant: "success" },
        ]}
      />

      {smsErrorMessage ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[1px]">
          <div
            role="alertdialog"
            aria-labelledby="sms-error-title"
            className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl dark:border-amber-900/40 dark:bg-zinc-950"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                ⚠️
              </div>
              <div className="space-y-2">
                <p id="sms-error-title" className="text-base font-semibold text-amber-900 dark:text-amber-100">
                  Impossibile inviare l&apos;SMS
                </p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">{smsErrorMessage}</p>
                {smsErrorMessage.toLowerCase().includes("telefono") ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Aggiungi o aggiorna il numero di telefono del paziente dalla sezione dati di
                    contatto, poi riprova.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Link
                href={`/pazienti/${patient.id}?openContact=1#contact-info`}
                className="inline-flex items-center justify-center rounded-full border border-amber-200 px-3 py-1 text-sm font-semibold text-amber-800 transition hover:border-amber-300 hover:text-amber-900 dark:border-amber-800 dark:text-amber-200 dark:hover:border-amber-700 dark:hover:text-amber-100"
              >
                Vai ai dati di contatto
              </Link>
              <Link
                href={`/pazienti/${patient.id}`}
                className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-4 py-1 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Chiudi
              </Link>
            </div>
          </div>
        </div>
      ) : null}
      {accessErrorMessage ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[1px]">
          <div
            role="alertdialog"
            aria-labelledby="access-error-title"
            className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl dark:border-amber-900/40 dark:bg-zinc-950"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                ⚠️
              </div>
              <div className="space-y-2">
                <p id="access-error-title" className="text-base font-semibold text-amber-900 dark:text-amber-100">
                  Impossibile inviare l&apos;email
                </p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">{accessErrorMessage}</p>
                {accessErrorMessage.toLowerCase().includes("email") ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Aggiungi o aggiorna l&apos;email del paziente dalla sezione dati di contatto,
                    poi riprova.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Link
                href={`/pazienti/${patient.id}?openContact=1#contact-info`}
                className="inline-flex items-center justify-center rounded-full border border-amber-200 px-3 py-1 text-sm font-semibold text-amber-800 transition hover:border-amber-300 hover:text-amber-900 dark:border-amber-800 dark:text-amber-200 dark:hover:border-amber-700 dark:hover:text-amber-100"
              >
                Vai ai dati di contatto
              </Link>
              <Link
                href={`/pazienti/${patient.id}`}
                className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-4 py-1 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Chiudi
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {consentErrorMessage ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[1px]">
          <div
            role="alertdialog"
            aria-labelledby="consent-error-title"
            className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl dark:border-amber-900/40 dark:bg-zinc-950"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                ⚠️
              </div>
              <div className="space-y-2">
                <p id="consent-error-title" className="text-base font-semibold text-amber-900 dark:text-amber-100">
                  Non possiamo salvare questo consenso
                </p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">{consentErrorMessage}</p>
                {consentErrorMessage.toLowerCase().includes("esiste già") ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Ogni tipo di consenso può essere registrato una sola volta per paziente. Modifica
                    quello esistente o scegli un tipo diverso.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Link
                href={`/pazienti/${patient.id}`}
                className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-4 py-1 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Chiudi
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-6">
          <details
            className="group rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 [&_summary::-webkit-details-marker]:hidden"
            open={openContactPanel}
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl px-6 py-4 text-left">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="pg-badge-base pg-badge-emerald uppercase tracking-wide">
                  PIN {patientPin}
                </span>
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-emerald-100 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20">
                  <PatientAvatar
                    src={patient.photoUrl}
                    alt={`${patient.lastName} ${patient.firstName}`}
                    gender={patient.gender}
                    size={56}
                    className="h-full w-full rounded-full"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Scheda paziente</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                      {patient.lastName} {patient.firstName}
                    </h1>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      {patient.email ?? "—"} · {patient.phone ?? "—"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <PrintLinkButton
                  href={`/pazienti/${patient.id}/scheda`}
                  label="Stampa scheda paziente"
                  target="_blank"
                  rel="noreferrer"
                  className="h-8 w-8 rounded-full border-sky-200 text-sky-700 dark:border-sky-900/40 dark:text-sky-300"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M6 9V4h12v5" />
                    <path d="M6 18h12v2H6z" />
                    <path d="M6 14h12v4H6z" />
                    <path d="M4 10h16a2 2 0 0 1 2 2v3h-4" />
                    <path d="M2 15h4" />
                  </svg>
                </PrintLinkButton>
                <svg
                  className="h-5 w-5 text-zinc-600 transition-transform duration-200 group-open:rotate-180"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </summary>
            <div className="border-t border-zinc-200 px-6 pb-6 pt-4 dark:border-zinc-800">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px,1fr]">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-xs shadow-sm dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                  <div className="flex items-center justify-between gap-4">
                    <PatientAvatar
                      src={patient.photoUrl}
                      alt={`${patient.lastName} ${patient.firstName}`}
                      gender={patient.gender}
                      size={112}
                      className="h-28 w-28 rounded-full"
                    />
                    <PatientPhotoDialog
                      patientId={patient.id}
                      fullName={`${patient.lastName} ${patient.firstName}`}
                      photoUrl={patient.photoUrl}
                      gender={patient.gender}
                      uploadPhoto={uploadPhotoAction}
                      resetPhoto={resetPhotoAction}
                    />
                  </div>
                </div>

                <div className="space-y-6" id="contact-info">
                  <UnsavedChangesGuard formId="patient-update-form" />
                  <form
                    action={updatePatientAction}
                    className="space-y-6"
                    id="patient-update-form"
                  >
                    <input type="hidden" name="patientId" value={patient.id} />
                    <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Dati Personali</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Informazioni personali del paziente.</p>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <label className="flex flex-col gap-2 text-sm font-medium text-rose-600">
                          Cognome
                          <input
                            name="lastName"
                            defaultValue={patient.lastName}
                            className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:ring-emerald-900"
                            required
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-medium text-rose-600">
                          Nome
                          <input
                            name="firstName"
                            defaultValue={patient.firstName}
                            className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:ring-emerald-900"
                            required
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          Indirizzo
                          <input
                            name="address"
                            defaultValue={parsedAddress}
                            className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:ring-emerald-900"
                            placeholder="Via, Numero Civico"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          Città
                          <input
                            name="city"
                            defaultValue={parsedCity}
                            className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:ring-emerald-900"
                            placeholder="Città"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          Genere
                          <select
                            name="gender"
                            defaultValue={patient.gender ?? Gender.NOT_SPECIFIED}
                            className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                          >
                            <option value={Gender.NOT_SPECIFIED}>Non specificato</option>
                            <option value={Gender.FEMALE}>Femmina</option>
                            <option value={Gender.MALE}>Maschio</option>
                            <option value={Gender.OTHER}>Altro</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-medium text-rose-600">
                          Telefono
                          <input
                            name="phone"
                            defaultValue={patient.phone ?? ""}
                            className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:ring-emerald-900"
                            placeholder="Telefono"
                            required
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          Email
                          <input
                            name="email"
                            type="email"
                            defaultValue={patient.email ?? ""}
                            className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:ring-emerald-900"
                            placeholder="email@esempio.it"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          Codice Fiscale
                          <input
                            name="taxId"
                            defaultValue={parsedTaxId}
                            className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 uppercase outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:ring-emerald-900"
                            placeholder="Codice Fiscale"
                            maxLength={16}
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          Data di Nascita
                          <input
                            type="date"
                            name="birthDate"
                            defaultValue={formatOptionalDateInputValue(patient.birthDate)}
                            className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                          />
                        </label>
                      </div>
                    </section>

                    <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Anamnesi Generale</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Seleziona eventuali condizioni mediche presenti o passate.
                        </p>
                      </div>
                      <div
                        className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                        suppressHydrationWarning
                      >
                        {conditionsList.map((condition, index) => (
                          <label
                            key={`${condition}-${index}`}
                            className="inline-flex items-start gap-2 text-sm text-zinc-800 dark:text-zinc-200"
                          >
                            <input
                              type="checkbox"
                              name="conditions"
                              value={condition}
                              defaultChecked={parsedConditions.includes(condition)}
                              className="mt-1 h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950"
                            />
                            <span>{condition}</span>
                          </label>
                        ))}
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <PatientAnamnesisNotes
                          medicationsDefault={parsedMedications}
                          extraNotesDefault={parsedExtra}
                        />
                      </div>
                    </section>

                    <div className="flex flex-wrap items-center gap-3">
                      <FormSubmitButton className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-6 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600">
                        Aggiorna scheda paziente
                      </FormSubmitButton>
                    </div>
                  </form>

                </div>
              </div>
            </div>
          </details>

          <details className="group rounded-2xl border border-zinc-200 bg-zinc-50 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-3 border-b border-zinc-200 px-6 py-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              <span className="flex items-center gap-3">
                <svg
                  className="h-8 w-8 text-emerald-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 3h6l3 3v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
                  <path d="M15 3v4h4" />
                  <path d="M9 13h6" />
                  <path d="M9 17h4" />
                </svg>
                <span className="uppercase tracking-wide">Consensi & Privacy</span>
              </span>
              <div className="flex items-center gap-2">
                {hasConsents ? (
                  <PrintLinkButton
                    href={`/pazienti/${patient.id}/consensi`}
                    label="Stampa consensi"
                    target="_blank"
                    rel="noreferrer"
                    className="h-8 w-8 rounded-full border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M6 9V4h12v5" />
                      <path d="M6 18h12v2H6z" />
                      <path d="M6 14h12v4H6z" />
                      <path d="M4 10h16a2 2 0 0 1 2 2v3h-4" />
                      <path d="M2 15h4" />
                    </svg>
                  </PrintLinkButton>
                ) : null}
                <svg
                  className="h-5 w-5 text-zinc-600 transition-transform duration-200 group-open:rotate-180 dark:text-zinc-300"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </summary>
            <div className="grid grid-cols-1 gap-4 px-6 pb-6 pt-4 lg:grid-cols-[1.1fr,0.9fr]">
                      <div className="space-y-3">
                        <PatientPaperConsentToggle
                          patientId={patient.id}
                          defaultChecked={patient.hasPaperConsentForRequired}
                        />
                        {missingRequired.length > 0 ? (
                          <div className="flex flex-wrap gap-2 text-xs font-semibold">
                            {missingRequired.map((module) => (
                              <span
                                key={module.id}
                                className={`rounded-full px-3 py-1 ${
                                  patient.hasPaperConsentForRequired
                                    ? "border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800/60 dark:bg-violet-900/20 dark:text-violet-300"
                                    : "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-900/20 dark:text-rose-200"
                                }`}
                              >
                                {patient.hasPaperConsentForRequired
                                  ? `${module.name} su scheda cartacea`
                                  : `${module.name} mancante`}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {patient.consents.length === 0 ? (
                          <p className="text-sm text-zinc-600 dark:text-zinc-300">Nessun consenso registrato.</p>
                        ) : (
                          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                            {patient.consents.map((consent) => {
                              const signatureUrl = (consent as { signatureUrl?: string | null }).signatureUrl;
                              return (
                                <div
                                  key={consent.id}
                                className="flex flex-col gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                                >
                                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase text-emerald-800">
                                    <span className="rounded-full bg-white px-2 py-1 dark:bg-zinc-900">
                                      {consent.module?.name ?? "Modulo"}
                                    </span>
                                    <span className="rounded-full bg-emerald-700 px-3 py-1 text-white">
                                      {consentStatusLabels[consent.status] ?? consent.status}
                                    </span>
                                    <span className="text-emerald-900">
                                      {formatDateInDisplayTimeZone(
                                        new Date(consent.givenAt),
                                        {
                                          dateStyle: "short",
                                          timeStyle: "short",
                                        },
                                        displayTimeZone
                                      )}
                                    </span>
                                    {signatureUrl ? (
                                      <Link
                                        href={`/pazienti/${patient.id}/consensi/${consent.id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-emerald-800 underline decoration-emerald-200 underline-offset-2 hover:text-emerald-900 dark:bg-zinc-900 dark:text-emerald-200 dark:decoration-emerald-900/40 dark:hover:text-emerald-100"
                                      >
                                        Stampa
                                      </Link>
                                    ) : (
                                      <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                                        Firma non disponibile
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-emerald-900">
                                    Canale: {consent.channel ?? "—"}
                                    {consent.expiresAt
                                      ? ` · Scadenza: ${formatDateInDisplayTimeZone(
                                          new Date(consent.expiresAt),
                                          { dateStyle: "short" },
                                          displayTimeZone
                                        )}`
                                      : ""}
                                    {consent.revokedAt
                                      ? ` · Revocato: ${formatDateInDisplayTimeZone(
                                          new Date(consent.revokedAt),
                                          { dateStyle: "short" },
                                          displayTimeZone
                                        )}`
                                      : ""}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        <ConsentForm
                          patientId={patient.id}
                          modules={consentModules}
                          doctors={doctors}
                          consents={activeConsents.map((consent) => ({
                            id: consent.id,
                            moduleId: consent.moduleId,
                            status: consent.status,
                            channel: consent.channel,
                            givenAt: consent.givenAt,
                            signatureUrl: (consent as { signatureUrl?: string | null }).signatureUrl ?? null,
                            module: consent.module ? { name: consent.module.name } : null,
                          }))}
                          revokeAction={revokeConsentAction}
                        />
                        {canExport ? (
                            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                              Strumenti GDPR
                            </p>
                              <p className="mt-2 text-sm text-emerald-900 dark:text-emerald-100">
                              Esporta o elimina i dati personali per richieste dell&apos;interessato.
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {canExport ? (
                                <a
                                  href={`/api/patients/${patient.id}/export`}
                                  className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-800 transition hover:border-emerald-300 dark:border-emerald-800 dark:bg-zinc-900 dark:text-emerald-300"
                                >
                                  Scarica dati
                                </a>
                              ) : null}
                              {isAdmin ? <PatientDeleteButton patientId={patient.id} role={user.role} /> : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
          </details>

          {canViewClinicalRecords ? (
            <DentalChart
              patientId={patient.id}
              initialRecords={dentalRecordsSerialized}
              services={services.map((service) => ({ id: service.id, name: service.name }))}
              printHref={`/pazienti/${patient.id}/diario`}
              containerClassName="bg-zinc-50 dark:bg-zinc-900"
            />
          ) : null}

          <details className="group rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-3 border-b border-zinc-200 px-6 py-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              <span className="flex items-center gap-3">
                <svg
                  className="h-8 w-8 text-emerald-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
                  <path d="M22 7 12 13 2 7" />
                </svg>
                <span className="uppercase tracking-wide">Comunicazioni</span>
              </span>
              <svg
                className="h-5 w-5 text-zinc-600 transition-transform duration-200 group-open:rotate-180 dark:text-zinc-300"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <div className="space-y-4 p-6">
              <div className="grid gap-3 lg:grid-cols-3">
                <form action={sendPatientSmsAction} className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                  <input type="hidden" name="patientId" value={patient.id} />
                  <label className="flex flex-col gap-1">
                    Template
                    <select
                      name="templateId"
                      required
                      className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                      defaultValue={visibleSmsTemplates[0]?.id ?? ""}
                    >
                      <option value="" disabled>
                        Seleziona template
                      </option>
                      {visibleSmsTemplates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <FormSubmitButton className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600">
                    Invia SMS
                  </FormSubmitButton>
                </form>

                <form
                  action={sendPatientAccessEmailAction}
                  className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                >
                  <input type="hidden" name="patientId" value={patient.id} />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Invia accesso area pazienti</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      Invia il link di accesso all&apos;email del paziente:{" "}
                      <span className="font-semibold">{patient.email ?? "—"}</span>
                    </p>
                  </div>
                  <FormSubmitButton
                    disabled={!patient.email}
                    className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Invia email accesso
                  </FormSubmitButton>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Ultimo invio:{" "}
                    {lastAccessEmailLog
                      ? formatDateInDisplayTimeZone(
                          new Date(lastAccessEmailLog.createdAt),
                          {
                            dateStyle: "short",
                            timeStyle: "short",
                          },
                          displayTimeZone
                        )
                      : "mai"}
                  </p>
                </form>

                <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Promemoria WhatsApp</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      Invia un promemoria al numero:{" "}
                      <span className="font-semibold">{patientPhone ?? "—"}</span>
                    </p>
                  </div>
                  {whatsappHref ? (
                    <a
                      href={whatsappHref}
                      className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600"
                    >
                      Invia promemoria
                    </a>
                  ) : (
                    <span className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700/60 px-4 text-sm font-semibold text-white opacity-70">
                      Invia promemoria
                    </span>
                  )}
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Ultimo invio:{" "}
                    {lastWhatsappLog
                      ? formatDateInDisplayTimeZone(
                          new Date(lastWhatsappLog.createdAt),
                          {
                            dateStyle: "short",
                            timeStyle: "short",
                          },
                          displayTimeZone
                        )
                      : "mai"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Log invii</h3>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {smsLogs.length}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {smsLogs.length === 0 ? (
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">Nessun SMS inviato.</p>
                  ) : (
                    smsLogs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-50">{log.to}</span>
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                              log.status === "SENT" || log.status === "SIMULATED"
                                ? "bg-emerald-50 text-emerald-800"
                                : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {log.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                          {log.template?.name ? `${log.template.name} · ` : ""}
                          {formatDateInDisplayTimeZone(
                            new Date(log.createdAt),
                            {
                              dateStyle: "short",
                              timeStyle: "short",
                            },
                            displayTimeZone
                          )}
                        </p>
                        <p className="line-clamp-2 text-sm text-zinc-700 dark:text-zinc-300">{log.body}</p>
                        {log.error ? (
                          <p className="text-[11px] text-rose-600">Errore: {log.error}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </details>

        </div>

          <PatientImplantAssociations
            patientId={patient.id}
            products={implantProductOptions}
            implants={implantAssociationItems}
            addAction={addImplantAssociationAction}
            updateAction={updateImplantAssociationAction}
          />
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <svg
            className="h-8 w-8 text-emerald-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M8 2v4" />
            <path d="M16 2v4" />
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18" />
            <path d="M8 14h4" />
          </svg>
          <h2 className="text-lg font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-50">
            Storico appuntamenti
          </h2>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          {pastAppointments.length}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {pastAppointments.length === 0 ? (
          <p className="py-4 text-sm text-zinc-600 dark:text-zinc-400">Nessun appuntamento passato.</p>
        ) : (
          pastAppointments.slice(0, 5).map((appt) => (
            <div
              key={appt.id}
              className="rounded-2xl border border-zinc-200 bg-gradient-to-r from-white via-zinc-50 to-white p-4 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                      <span aria-hidden="true">
                        {(appt.serviceType ?? "").toLowerCase().includes("odo") ||
                        (appt.doctor?.specialty ?? "").toLowerCase().includes("odo")
                          ? "🦷"
                          : "❤️"}
                      </span>
                      {appt.title}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                      {appt.serviceType}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-800 dark:text-zinc-200">
                    🧑‍⚕️ Paziente {patient.lastName} {patient.firstName} è stato visto da{" "}
                    <span className="font-semibold">{appt.doctor?.fullName ?? "—"}</span>{" "}
                    il{" "}
                    {formatDateInDisplayTimeZone(
                      appt.startsAt,
                      {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      },
                      displayTimeZone
                    )}{" "}
                    alle{" "}
                    {formatDateInDisplayTimeZone(
                      appt.startsAt,
                      { timeStyle: "short" },
                      displayTimeZone
                    )}
                    .
                  </p>
                  <p className="text-sm text-zinc-800 dark:text-zinc-200">
                    🕒 Il servizio ha richiesto circa{" "}
                    {Math.max(
                      1,
                      Math.round(
                        (appt.endsAt.getTime() - appt.startsAt.getTime()) / (1000 * 60 * 60)
                      )
                    )}{" "}
                    ora/e.
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase ${statusClasses[appt.status]}`}
                  >
                    {statusLabels[appt.status].toUpperCase()}
                  </span>
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                    {formatDateInDisplayTimeZone(
                      appt.startsAt,
                      {
                        day: "numeric",
                        month: "short",
                      },
                      displayTimeZone
                    )}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>

    <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-3">
        <svg
          className="h-8 w-8 text-emerald-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 3h6l3 3v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
          <path d="M15 3v4h4" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
        </svg>
        <h2 className="text-lg font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-50">
          Storico scheda
        </h2>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Creata il
          </p>
          <p className="mt-2 font-medium text-zinc-900 dark:text-zinc-50">{createdAtLabel}</p>
          <p className="mt-1">Da: {createdBy}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Ultimo aggiornamento
          </p>
          <p className="mt-2 font-medium text-zinc-900 dark:text-zinc-50">{updatedAtLabel}</p>
          <p className="mt-1">Da: {updatedBy}</p>
        </div>
      </div>
    </section>
  </>
  );
}
