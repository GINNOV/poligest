import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getRoleFeatureAccess, requireFeatureAccess } from "@/lib/feature-access";
import { Role, AppointmentStatus, Gender } from "@prisma/client";
import { FormSubmitButton } from "@/components/form-submit-button";
import { PatientAvatar } from "@/components/patient-avatar";
import { PatientPhotoDialog } from "@/components/patient-photo-dialog";
import { DentalChart } from "@/components/dental-chart";
import { PatientAnamnesisNotes } from "@/components/patient-anamnesis-notes";
import { ConsentForm } from "@/components/consent-form";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { QuoteAccordion } from "@/components/quote-accordion";
import { PageToastTrigger } from "@/components/page-toast-trigger";
import { PatientDeleteButton } from "@/components/patient-delete-button";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { PrintLinkButton } from "@/components/print-link-button";
import {
  addImplantAssociationAction,
  resetPhotoAction,
  revokeConsentAction,
  savePreventivoAction,
  sendPatientAccessEmailAction,
  sendPatientSmsAction,
  updateImplantAssociationAction,
  updatePatientAction,
  uploadPhotoAction,
} from "@/lib/patients/actions";
import { getPatientDetailPageData } from "@/lib/patients/page-data";

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
  TO_CONFIRM: "border-amber-200 bg-amber-50 text-amber-800 shadow-sm",
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm",
  IN_WAITING: "border-zinc-200 bg-zinc-50 text-zinc-700 shadow-sm",
  IN_PROGRESS: "border-sky-200 bg-sky-50 text-sky-800 shadow-sm",
  COMPLETED: "border-green-200 bg-green-50 text-green-800 shadow-sm",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-800 shadow-sm",
  NO_SHOW: "border-slate-200 bg-slate-50 text-slate-700 shadow-sm",
};

const formatDateTime = (value: Date | string | null | undefined) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const formatAuditActor = (actor: { name: string | null; email: string | null } | null | undefined) =>
  actor?.name ?? actor?.email ?? "—";

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
  const canViewQuotes = featureAccess.isAllowed("quotes");
  const canViewClinicalRecords = featureAccess.isAllowed("clinical-records");
  const isAdmin = user.role === Role.ADMIN;
  const canExport = isAdmin || user.role === Role.MANAGER;

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
    parsedQuote,
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
      <div className="order-2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-zinc-600">Paziente non trovato.</p>
        <Link
          href="/pazienti"
          className="mt-4 inline-flex rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-emerald-800"
        >
          Torna a Pazienti
        </Link>
      </div>
    );
  }

  const activeConsents = patient.consents.filter((consent) => consent.status === "GRANTED");
  const createdBy = formatAuditActor(createdLog?.user);
  const updatedBy = updatedLog ? formatAuditActor(updatedLog.user) : createdBy;
  const createdAtLabel = formatDateTime(createdLog?.createdAt ?? patient.createdAt);
  const updatedAtLabel = formatDateTime(updatedLog?.createdAt ?? patient.updatedAt);

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
            className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                ⚠️
              </div>
              <div className="space-y-2">
                <p id="sms-error-title" className="text-base font-semibold text-amber-900">
                  Impossibile inviare l&apos;SMS
                </p>
                <p className="text-sm text-zinc-700">{smsErrorMessage}</p>
                {smsErrorMessage.toLowerCase().includes("telefono") ? (
                  <p className="text-xs text-zinc-500">
                    Aggiungi o aggiorna il numero di telefono del paziente dalla sezione dati di
                    contatto, poi riprova.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Link
                href={`/pazienti/${patient.id}?openContact=1#contact-info`}
                className="inline-flex items-center justify-center rounded-full border border-amber-200 px-3 py-1 text-sm font-semibold text-amber-800 transition hover:border-amber-300 hover:text-amber-900"
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
            className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                ⚠️
              </div>
              <div className="space-y-2">
                <p id="access-error-title" className="text-base font-semibold text-amber-900">
                  Impossibile inviare l&apos;email
                </p>
                <p className="text-sm text-zinc-700">{accessErrorMessage}</p>
                {accessErrorMessage.toLowerCase().includes("email") ? (
                  <p className="text-xs text-zinc-500">
                    Aggiungi o aggiorna l&apos;email del paziente dalla sezione dati di contatto,
                    poi riprova.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Link
                href={`/pazienti/${patient.id}?openContact=1#contact-info`}
                className="inline-flex items-center justify-center rounded-full border border-amber-200 px-3 py-1 text-sm font-semibold text-amber-800 transition hover:border-amber-300 hover:text-amber-900"
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
            className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                ⚠️
              </div>
              <div className="space-y-2">
                <p id="consent-error-title" className="text-base font-semibold text-amber-900">
                  Non possiamo salvare questo consenso
                </p>
                <p className="text-sm text-zinc-700">{consentErrorMessage}</p>
                {consentErrorMessage.toLowerCase().includes("esiste già") ? (
                  <p className="text-xs text-zinc-500">
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
            className="group rounded-2xl border border-zinc-200 bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden"
            open={openContactPanel}
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl px-6 py-4 text-left">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                  PIN {patientPin}
                </span>
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-emerald-100 bg-emerald-50 text-lg font-semibold text-emerald-800">
                  <PatientAvatar
                    src={patient.photoUrl}
                    alt={`${patient.lastName} ${patient.firstName}`}
                    gender={patient.gender}
                    size={56}
                    className="h-full w-full rounded-full"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm uppercase tracking-wide text-zinc-600">Scheda paziente</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold text-zinc-900">
                      {patient.lastName} {patient.firstName}
                    </h1>
                    <p className="text-sm text-zinc-700">
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
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-200 text-sky-700 transition hover:border-sky-300 hover:text-sky-800"
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
            <div className="border-t border-zinc-200 px-6 pb-6 pt-4">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px,1fr]">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-xs shadow-sm">
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
                    <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-zinc-900">Dati Personali</p>
                        <p className="text-xs text-zinc-500">Informazioni personali del paziente.</p>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <label className="flex flex-col gap-2 text-sm font-medium text-rose-600">
                          Cognome
                          <input
                            name="lastName"
                            defaultValue={patient.lastName}
                            className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            required
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-medium text-rose-600">
                          Nome
                          <input
                            name="firstName"
                            defaultValue={patient.firstName}
                            className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            required
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                          Indirizzo
                          <input
                            name="address"
                            defaultValue={parsedAddress}
                            className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            placeholder="Via, Numero Civico"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                          Città
                          <input
                            name="city"
                            defaultValue={parsedCity}
                            className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            placeholder="Città"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                          Genere
                          <select
                            name="gender"
                            defaultValue={patient.gender ?? Gender.NOT_SPECIFIED}
                            className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
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
                            className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            placeholder="Telefono"
                            required
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                          Email
                          <input
                            name="email"
                            type="email"
                            defaultValue={patient.email ?? ""}
                            className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            placeholder="email@esempio.it"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                          Codice Fiscale
                          <input
                            name="taxId"
                            defaultValue={parsedTaxId}
                            className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 uppercase outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            placeholder="Codice Fiscale"
                            maxLength={16}
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                          Data di Nascita
                          <input
                            type="date"
                            name="birthDate"
                            defaultValue={
                              patient.birthDate
                                ? new Date(patient.birthDate).toISOString().split("T")[0]
                                : ""
                            }
                            className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          />
                        </label>
                      </div>
                    </section>

                    <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-zinc-900">Anamnesi Generale</p>
                        <p className="text-xs text-zinc-500">
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
                            className="inline-flex items-start gap-2 text-sm text-zinc-800"
                          >
                            <input
                              type="checkbox"
                              name="conditions"
                              value={condition}
                              defaultChecked={parsedConditions.includes(condition)}
                              className="mt-1 h-4 w-4 rounded border-zinc-300"
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

          <details className="group rounded-2xl border border-zinc-200 bg-zinc-50 shadow-sm [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-3 border-b border-zinc-200 px-6 py-4 text-base font-semibold text-zinc-900">
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
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition hover:border-emerald-200 hover:text-emerald-700"
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
            <div className="grid grid-cols-1 gap-4 px-6 pb-6 pt-4 lg:grid-cols-[1.1fr,0.9fr]">
                      <div className="space-y-3">
                        {missingRequired.length > 0 ? (
                          <div className="flex flex-wrap gap-2 text-xs font-semibold">
                            {missingRequired.map((module) => (
                              <span
                                key={module.id}
                                className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700"
                              >
                                {module.name} mancante
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {patient.consents.length === 0 ? (
                          <p className="text-sm text-zinc-600">Nessun consenso registrato.</p>
                        ) : (
                          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                            {patient.consents.map((consent) => {
                              const signatureUrl = (consent as { signatureUrl?: string | null }).signatureUrl;
                              return (
                                <div
                                  key={consent.id}
                                  className="flex flex-col gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900"
                                >
                                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase text-emerald-800">
                                    <span className="rounded-full bg-white px-2 py-1">
                                      {consent.module?.name ?? "Modulo"}
                                    </span>
                                    <span className="rounded-full bg-emerald-700 px-3 py-1 text-white">
                                      {consentStatusLabels[consent.status] ?? consent.status}
                                    </span>
                                    <span className="text-emerald-900">
                                      {new Date(consent.givenAt).toLocaleString("it-IT", {
                                        dateStyle: "short",
                                        timeStyle: "short",
                                      })}
                                    </span>
                                    {signatureUrl ? (
                                      <Link
                                        href={`/pazienti/${patient.id}/consensi/${consent.id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-emerald-800 underline decoration-emerald-200 underline-offset-2 hover:text-emerald-900"
                                      >
                                        Stampa
                                      </Link>
                                    ) : (
                                      <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-zinc-500">
                                        Firma non disponibile
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-emerald-900">
                                    Canale: {consent.channel ?? "—"}
                                    {consent.expiresAt
                                      ? ` · Scadenza: ${new Date(consent.expiresAt).toLocaleDateString("it-IT")}`
                                      : ""}
                                    {consent.revokedAt
                                      ? ` · Revocato: ${new Date(consent.revokedAt).toLocaleDateString("it-IT")}`
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
                          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                              Strumenti GDPR
                            </p>
                            <p className="mt-2 text-sm text-emerald-900">
                              Esporta o elimina i dati personali per richieste dell&apos;interessato.
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {canExport ? (
                                <a
                                  href={`/api/patients/${patient.id}/export`}
                                  className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-800 transition hover:border-emerald-300"
                                >
                                  Scarica dati
                                </a>
                              ) : null}
                              {isAdmin ? <PatientDeleteButton patientId={patient.id} /> : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
          </details>

          {canViewQuotes ? (
            <QuoteAccordion
              patientId={patient.id}
              patientName={`${patient.lastName} ${patient.firstName}`.trim() || "Paziente"}
              services={services.map((service) => ({
                id: service.id,
                name: service.name,
                costBasis: Number(service.costBasis?.toString?.() ?? service.costBasis ?? 0),
              }))}
              initialQuote={parsedQuote}
              printHref={parsedQuote?.id ? `/pazienti/${patient.id}/preventivo/${parsedQuote.id}` : null}
              className="bg-white"
              onSave={savePreventivoAction}
            />
          ) : null}

          {canViewClinicalRecords ? (
            <DentalChart
              patientId={patient.id}
              initialRecords={dentalRecordsSerialized}
              services={services.map((service) => ({ id: service.id, name: service.name }))}
              printHref={`/pazienti/${patient.id}/diario`}
              containerClassName="bg-zinc-50"
            />
          ) : null}

          <details className="group rounded-2xl border border-zinc-200 bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-3 border-b border-zinc-200 px-6 py-4 text-base font-semibold text-zinc-900">
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
            </summary>
            <div className="space-y-4 p-6">
              <div className="grid gap-3 lg:grid-cols-3">
                <form action={sendPatientSmsAction} className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800">
                  <input type="hidden" name="patientId" value={patient.id} />
                  <label className="flex flex-col gap-1">
                    Template
                    <select
                      name="templateId"
                      required
                      className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
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
                  className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-800"
                >
                  <input type="hidden" name="patientId" value={patient.id} />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-900">Invia accesso area pazienti</p>
                    <p className="text-xs text-zinc-600">
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
                  <p className="text-xs text-zinc-500">
                    Ultimo invio:{" "}
                    {lastAccessEmailLog
                      ? new Date(lastAccessEmailLog.createdAt).toLocaleString("it-IT", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "mai"}
                  </p>
                </form>

                <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-800">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-900">Promemoria WhatsApp</p>
                    <p className="text-xs text-zinc-600">
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
                  <p className="text-xs text-zinc-500">
                    Ultimo invio:{" "}
                    {lastWhatsappLog
                      ? new Date(lastWhatsappLog.createdAt).toLocaleString("it-IT", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "mai"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-900">Log invii</h3>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700">
                    {smsLogs.length}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {smsLogs.length === 0 ? (
                    <p className="text-sm text-zinc-600">Nessun SMS inviato.</p>
                  ) : (
                    smsLogs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-zinc-900">{log.to}</span>
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
                        <p className="text-[11px] text-zinc-600">
                          {log.template?.name ? `${log.template.name} · ` : ""}
                          {new Date(log.createdAt).toLocaleString("it-IT")}
                        </p>
                        <p className="text-sm text-zinc-700 line-clamp-2">{log.body}</p>
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

      <details className="group rounded-2xl border border-zinc-200 bg-zinc-50 p-6 shadow-sm [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer items-center justify-between gap-3 border-b border-zinc-200 pb-4 text-base font-semibold text-zinc-900">
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
              <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
              <path d="M14 3v5h5" />
            </svg>
            <span className="uppercase tracking-wide">Associa impianti</span>
          </span>
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
        </summary>
        <p className="pt-4 text-sm text-zinc-600">
          Registra impianti/protesi collegati al paziente utilizzando i dati di magazzino.
        </p>

        <div className="mt-4 space-y-4">
          <div className="relative overflow-x-auto rounded-2xl border border-zinc-200">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white/90 to-transparent sm:hidden" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white/90 to-transparent sm:hidden" />
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="px-3 py-2 text-left">Tipo di DM</th>
                  <th className="px-3 py-2 text-left">Marca</th>
                  <th className="px-3 py-2 text-left">UDI-DI</th>
                  <th className="px-3 py-2 text-left">UDI-PI</th>
                  <th className="px-3 py-2 text-left">Data acquisto</th>
                  <th className="px-3 py-2 text-left">Data intervento</th>
                  <th className="px-3 py-2 text-left">Sede intervento</th>
                  <th className="px-3 py-2 text-left">Modifica</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {implants.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-sm text-zinc-600" colSpan={8}>
                      Nessun impianto associato.
                    </td>
                  </tr>
                ) : (
                  implants.map((imp) => {
                    const note = imp.note ?? "";
                    const deviceType = note.match(/Tipo:\s*([^·]+)/)?.[1]?.trim() ?? imp.product?.name ?? "—";
                    const brandFromNote = note.match(/Marca:\s*([^·]+)/)?.[1]?.trim();
                    const udiDiFromNote = note.match(/UDI-DI:\s*([^·]+)/)?.[1]?.trim();
                    const brand =
                      brandFromNote ?? imp.product?.supplier?.name ?? (imp.product?.name ? "—" : "—");
                    return (
                      <tr key={imp.id} className="hover:bg-zinc-50">
                        <td className="px-3 py-2 text-zinc-900">{deviceType}</td>
                        <td className="px-3 py-2 text-zinc-700">{brand ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs text-zinc-600">
                          {udiDiFromNote ?? imp.product?.udiDi ?? "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-zinc-600">{imp.udiPi ?? "—"}</td>
                        <td className="px-3 py-2 text-zinc-700">
                          {imp.purchaseDate
                            ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(imp.purchaseDate)
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-zinc-700">
                          {imp.interventionDate
                            ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(imp.interventionDate)
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-zinc-700">{imp.interventionSite ?? "—"}</td>
                        <td className="px-3 py-2">
                          <details className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 shadow-sm">
                            <summary className="cursor-pointer font-semibold text-emerald-800">Modifica</summary>
                            <form action={updateImplantAssociationAction} className="mt-2 grid grid-cols-1 gap-2">
                              <input type="hidden" name="implantId" value={imp.id} />
                              <input type="hidden" name="patientId" value={patient.id} />
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                Prodotto
                                <select
                                  name="productId"
                                  defaultValue={imp.productId}
                                  className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                >
                                  {products.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} {p.supplier?.name ? `· ${p.supplier.name}` : ""} {p.udiDi ? `· ${p.udiDi}` : ""}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                Tipo DM
                                <input
                                  name="deviceType"
                                  defaultValue={deviceType !== "—" ? deviceType : ""}
                                  className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                Marca
                                <input
                                  name="brand"
                                  defaultValue={brand ?? ""}
                                  className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                UDI-DI
                                <input
                                  name="udiDi"
                                  defaultValue={udiDiFromNote ?? imp.product?.udiDi ?? ""}
                                  className="h-9 rounded-lg border border-zinc-200 px-2 font-mono text-xs text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                  placeholder="UDI-DI"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                UDI-PI
                                <input
                                  name="udiPi"
                                  defaultValue={imp.udiPi ?? ""}
                                  className="h-9 rounded-lg border border-zinc-200 px-2 font-mono text-xs text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                Data acquisto
                                <input
                                  type="date"
                                  name="purchaseDate"
                                  defaultValue={
                                    imp.purchaseDate ? imp.purchaseDate.toISOString().split("T")[0] : ""
                                  }
                                  className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                Data intervento
                                <input
                                  type="date"
                                  name="interventionDate"
                                  defaultValue={
                                    imp.interventionDate ? imp.interventionDate.toISOString().split("T")[0] : ""
                                  }
                                  className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                Sede
                                <input
                                  name="interventionSite"
                                  defaultValue={imp.interventionSite ?? ""}
                                  className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                />
                              </label>
                              <div className="flex justify-end pt-1">
                                <button
                                  type="submit"
                                  className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-600"
                                >
                                  Aggiorna
                                </button>
                              </div>
                            </form>
                          </details>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <details className="group rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:border-emerald-200 hover:bg-emerald-50">
              <span>Dettagli impianto</span>
              <svg
                className="h-4 w-4 text-emerald-700 transition-transform duration-200 group-open:rotate-180"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                  clipRule="evenodd"
                />
              </svg>
            </summary>
            <form action={addImplantAssociationAction} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input type="hidden" name="patientId" value={patient.id} />
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Prodotto / Tipo di DM
                <select
                  name="productId"
                  className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Seleziona prodotto
                  </option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.supplier?.name ? `· ${p.supplier.name}` : ""} {p.udiDi ? `· ${p.udiDi}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Marca
                <input
                  name="brand"
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Marca"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Tipo di DM (personalizzato)
                <input
                  name="deviceType"
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Es. Impianto, Protesi..."
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Codice UDI-DI
                <input
                  name="udiDi"
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="UDI-DI"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Codice UDI-PI
                <input
                  name="udiPi"
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="UDI-PI / Lotto"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Data acquisto
                <input
                  type="date"
                  name="purchaseDate"
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Data intervento
                <input
                  type="date"
                  name="interventionDate"
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Sede intervento
                <input
                  name="interventionSite"
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Es. 1.1, 2.4..."
                />
              </label>
              <div className="sm:col-span-2 flex justify-end">
                <FormSubmitButton className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600">
                  Associa impianto
                </FormSubmitButton>
              </div>
            </form>
          </details>
        </div>
      </details>
    </div>

    <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
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
          <h2 className="text-lg font-semibold uppercase tracking-wide text-zinc-900">
            Storico appuntamenti
          </h2>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          {pastAppointments.length}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {pastAppointments.length === 0 ? (
          <p className="py-4 text-sm text-zinc-600">Nessun appuntamento passato.</p>
        ) : (
          pastAppointments.slice(0, 5).map((appt) => (
            <div
              key={appt.id}
              className="rounded-2xl border border-zinc-200 bg-gradient-to-r from-white via-zinc-50 to-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                      <span aria-hidden="true">
                        {(appt.serviceType ?? "").toLowerCase().includes("odo") ||
                        (appt.doctor?.specialty ?? "").toLowerCase().includes("odo")
                          ? "🦷"
                          : "❤️"}
                      </span>
                      {appt.title}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-700">
                      {appt.serviceType}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-800">
                    🧑‍⚕️ Paziente {patient.lastName} {patient.firstName} è stato visto da{" "}
                    <span className="font-semibold">{appt.doctor?.fullName ?? "—"}</span>{" "}
                    il{" "}
                    {new Intl.DateTimeFormat("it-IT", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(appt.startsAt)}{" "}
                    alle {new Intl.DateTimeFormat("it-IT", { timeStyle: "short" }).format(appt.startsAt)}.
                  </p>
                  <p className="text-sm text-zinc-800">
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
                  <span className="text-xs font-semibold text-zinc-600">
                    {new Intl.DateTimeFormat("it-IT", {
                      day: "numeric",
                      month: "short",
                    }).format(appt.startsAt)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>

    <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
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
        <h2 className="text-lg font-semibold uppercase tracking-wide text-zinc-900">
          Storico scheda
        </h2>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Creata il
          </p>
          <p className="mt-2 font-medium text-zinc-900">{createdAtLabel}</p>
          <p className="mt-1">Da: {createdBy}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Ultimo aggiornamento
          </p>
          <p className="mt-2 font-medium text-zinc-900">{updatedAtLabel}</p>
          <p className="mt-1">Da: {updatedBy}</p>
        </div>
      </div>
    </section>
  </>
  );
}
