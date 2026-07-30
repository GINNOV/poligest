import Link from "next/link";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { prisma } from "@/lib/prisma";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { formatPhone } from "@/lib/phone";
import { formatAuditActor } from "@/lib/audit";
import {
  filterPotentialDuplicateGroups,
  findPotentialPatientDuplicates,
  type DuplicateMatchKind,
} from "@/lib/patients/duplicate-detection";
import {
  isPatientEmptyShell,
  loadFullAttachmentCounts,
} from "@/lib/patients/duplicate-attachments";
import {
  buildFieldFillPlan,
  classifyDuplicateGroup,
  type MergePatientSnapshot,
} from "@/lib/patients/duplicate-merge-plan";
import {
  canHardDeleteOthers,
  countNonEmptyPatients,
  getDuplicateFieldConflicts,
  getReviewGroupKind,
  type ReviewGroupKind,
} from "@/lib/patients/duplicate-ui";
import { parsePatientStructuredNotes } from "@/lib/patients/page-data-domain";
import { getAutoMergeEmptyDuplicates } from "@/lib/practice-settings";
import { DuplicateLegendHelpTooltip } from "@/components/duplicate-legend-help-tooltip";
import { PatientDuplicateResolveButton } from "@/components/patient-duplicate-resolve-button";
import { PatientDuplicateMergeButton } from "@/components/patient-duplicate-merge-button";
import { PatientDuplicateBulkMergeButton } from "@/components/patient-duplicate-bulk-merge-button";
import { AutoMergeDuplicatesSetting } from "@/components/auto-merge-duplicates-setting";
import { PatientDeleteButton } from "@/components/patient-delete-button";
import { isValidDate } from "@/lib/date";
import { formatDateInDisplayTimeZone } from "@/lib/user-display-time-zone";
import { getUserDisplayTimeZone } from "@/lib/user-display-time-zone.server";
import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";

export const metadata = createPageMetadata(PAGE_TITLES.cercaDuplicati);

type PatientDuplicateStatus = "complete" | "partial" | "critical";

type PatientCreationInfo = {
  createdAt: Date;
  createdBy: string;
};

function formatCreatedAt(value: Date | string | null | undefined, timeZone: string) {
  if (!value) return "—";
  return formatDateInDisplayTimeZone(
    new Date(value),
    {
      dateStyle: "short",
      timeStyle: "short",
    },
    timeZone,
  );
}

function formatBirthDate(value: Date | null) {
  if (!isValidDate(value)) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function getPatientMissingFields(patient: {
  email: string | null;
  phone: string | null;
  birthDate: Date | null;
  taxId: string | null;
}) {
  const missing: string[] = [];
  if (!patient.email) missing.push("email");
  if (!patient.phone) missing.push("telefono");
  if (!patient.birthDate) missing.push("data di nascita");
  if (!patient.taxId) missing.push("codice fiscale");
  return missing;
}

function getPatientStatus(missingFieldsCount: number): PatientDuplicateStatus {
  if (missingFieldsCount === 0) return "complete";
  if (missingFieldsCount >= 3) return "critical";
  return "partial";
}

function getStatusBadge(status: PatientDuplicateStatus) {
  switch (status) {
    case "complete":
      return {
        label: "Dati completi",
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200",
      };
    case "partial":
      return {
        label: "Dati da completare",
        className:
          "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200",
      };
    case "critical":
      return {
        label: "Molti dati mancanti",
        className:
          "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200",
      };
  }
}

type PatientAttachmentFlags = {
  hasPayments: boolean;
  hasDentalRecords: boolean;
  isEmptyShell: boolean;
};

function getAttachmentBadges(flags: PatientAttachmentFlags) {
  const badges: Array<{ key: string; label: string; className: string }> = [];

  if (flags.isEmptyShell) {
    badges.push({
      key: "empty",
      label: "Vuota",
      className:
        "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300",
    });
  } else {
    badges.push({
      key: "has-data",
      label: "Ha dati",
      className:
        "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200",
    });
  }

  if (flags.hasPayments) {
    badges.push({
      key: "payments",
      label: "Ha pagamenti",
      className:
        "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200",
    });
  }

  if (flags.hasDentalRecords) {
    badges.push({
      key: "dental-records",
      label: "Ha cartella clinica",
      className:
        "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-200",
    });
  }

  return badges;
}

function getCardClassName(status: PatientDuplicateStatus, safeGroup: boolean) {
  if (!safeGroup) {
    return "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-zinc-600";
  }
  switch (status) {
    case "complete":
      return "border-emerald-200 bg-emerald-50/70 hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/30";
    case "partial":
      return "border-amber-200 bg-amber-50/70 hover:border-amber-300 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 dark:hover:border-amber-800 dark:hover:bg-amber-950/30";
    case "critical":
      return "border-rose-200 bg-rose-50/70 hover:border-rose-300 hover:bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20 dark:hover:border-rose-800 dark:hover:bg-rose-950/30";
  }
}

function matchReasonSummary(kinds: DuplicateMatchKind[]): string {
  const labels = Array.from(new Set(kinds)).map((kind) => {
    switch (kind) {
      case "taxId":
        return "codice fiscale";
      case "email":
        return "email";
      case "phone":
        return "telefono";
      case "nameBirthDate":
        return "nome e data di nascita";
    }
  });
  if (labels.length === 0) return "";
  if (labels.length === 1) return `Stesso ${labels[0]}`;
  const last = labels[labels.length - 1];
  return `Stesso ${labels.slice(0, -1).join(", ")} e ${last}`;
}

function groupGuidance(kind: ReviewGroupKind): string | null {
  switch (kind) {
    case "safe":
      return null;
    case "multi_data":
      return "Entrambe le schede hanno dati collegati. Confrontale aprendo le schede; non eliminare da qui.";
    case "identity_conflict":
      return "Codice fiscale o data di nascita diversi. Controlla prima di unire o eliminare.";
    case "review":
      return "Confronta le schede prima di agire.";
  }
}

function fieldDisplayValue(
  field: "email" | "phone" | "birthDate" | "taxId",
  patient: {
    email: string | null;
    phone: string | null;
    birthDate: Date | null;
    taxId: string | null;
  },
) {
  switch (field) {
    case "email":
      return patient.email?.trim() || "—";
    case "phone":
      return formatPhone(patient.phone);
    case "birthDate":
      return formatBirthDate(patient.birthDate);
    case "taxId":
      return patient.taxId?.trim() || "—";
  }
}

function getSingleSearchParam(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams | undefined,
  key: string,
) {
  if (!searchParams) return "";
  if (searchParams instanceof URLSearchParams) {
    return searchParams.get(key)?.trim() ?? "";
  }
  const value = searchParams[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function PazientiDuplicatiPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined> | URLSearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const searchQuery = getSingleSearchParam(resolvedSearchParams, "q");
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  await requireFeatureAccess(user.role, "patients");

  const patients = await prisma.patient.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      birthDate: true,
      gender: true,
      notes: true,
      taxId: true,
      photoUrl: true,
      hasPaperConsentForRequired: true,
      createdAt: true,
    },
  });

  const patientById = new Map(patients.map((patient) => [patient.id, patient]));
  const allGroups = findPotentialPatientDuplicates(patients);
  const groups = filterPotentialDuplicateGroups(allGroups, searchQuery);
  // Counts/classifications for *all* groups so bulk merge (practice-wide API) matches the banner count.
  const allDuplicatePatientIds = Array.from(
    new Set(allGroups.flatMap((group) => group.patients.map((patient) => patient.id))),
  );
  const duplicatePatientIds = Array.from(
    new Set(groups.flatMap((group) => group.patients.map((patient) => patient.id))),
  );
  const totalPatients = duplicatePatientIds.length;
  const hasSearch = searchQuery.length > 0;

  const attachmentFlagsByPatientId = new Map<string, PatientAttachmentFlags>();
  const createdInfoByPatientId = new Map<string, PatientCreationInfo>();
  let displayTimeZone = "Europe/Rome";
  const fullCounts = await loadFullAttachmentCounts(allDuplicatePatientIds);
  const allClassifications = allGroups.map((group) => classifyDuplicateGroup(group, fullCounts));
  const classificationByGroupId = new Map(allClassifications.map((item) => [item.groupId, item]));
  const safeGroupCount = allClassifications.filter((item) => item.safe).length;
  const autoEligibleCount = allClassifications.filter((item) => item.autoEligible).length;
  const autoMergeEnabled = user.role === Role.ADMIN ? await getAutoMergeEmptyDuplicates() : false;

  if (duplicatePatientIds.length > 0) {
    const [createdLogs, resolvedDisplayTimeZone] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          action: "patient.created",
          entity: "Patient",
          entityId: { in: duplicatePatientIds },
        },
        orderBy: { createdAt: "asc" },
        select: {
          entityId: true,
          createdAt: true,
          role: true,
          metadata: true,
          user: { select: { name: true, email: true } },
        },
      }),
      getUserDisplayTimeZone(),
    ]);
    displayTimeZone = resolvedDisplayTimeZone;

    for (const patientId of duplicatePatientIds) {
      const counts = fullCounts.get(patientId);
      attachmentFlagsByPatientId.set(patientId, {
        hasPayments: Boolean(counts && counts.paymentCount > 0),
        hasDentalRecords: Boolean(counts && counts.dentalRecordCount > 0),
        isEmptyShell: counts ? isPatientEmptyShell(counts) : false,
      });
    }

    for (const log of createdLogs) {
      if (!log.entityId || createdInfoByPatientId.has(log.entityId)) continue;
      createdInfoByPatientId.set(log.entityId, {
        createdAt: log.createdAt,
        createdBy: formatAuditActor(log),
      });
    }
  }

  function toMergeSnapshot(patientId: string): MergePatientSnapshot | null {
    const patient = patientById.get(patientId);
    if (!patient) return null;
    const parsedTaxId = parsePatientStructuredNotes(patient.notes).parsedTaxId;
    return {
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      email: patient.email,
      phone: patient.phone,
      birthDate: patient.birthDate,
      gender: patient.gender,
      notes: patient.notes,
      photoUrl: patient.photoUrl,
      hasPaperConsentForRequired: patient.hasPaperConsentForRequired,
      taxId: patient.taxId || parsedTaxId || null,
      createdAt: patient.createdAt,
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Pazienti</p>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Cerca duplicati</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Controlla schede che condividono gli stessi dati chiave prima di unirle o aggiornarle.
          </p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          <div className="font-semibold">
            {groups.length} {hasSearch ? `di ${allGroups.length}` : ""} gruppi trovati
          </div>
          <div>{totalPatients} pazienti coinvolti</div>
          <div className="mt-1 text-xs">
            {safeGroupCount} unioni sicure · {autoEligibleCount} auto-unibili
          </div>
        </div>
      </div>

      {user.role === Role.ADMIN ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <p className="text-sm text-emerald-950 dark:text-emerald-100">
              Unisci in un colpo solo i gruppi in cui solo una scheda ha dati collegati e le altre
              sono vuote.
            </p>
            <PatientDuplicateBulkMergeButton safeGroupCount={safeGroupCount} />
          </div>
          <AutoMergeDuplicatesSetting enabled={autoMergeEnabled} />
        </div>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
        <form action="/pazienti/duplicati" method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            <span>Cerca nei duplicati</span>
            <input
              type="search"
              name="q"
              defaultValue={searchQuery}
              placeholder="Nome, telefono, email, codice fiscale, ID..."
              className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              Cerca
            </button>
            {hasSearch ? (
              <Link
                href="/pazienti/duplicati"
                className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-emerald-800 dark:hover:text-emerald-400"
              >
                Cancella
              </Link>
            ) : null}
          </div>
        </form>
      </section>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300">
        <span className="font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Legenda</span>
        <DuplicateLegendHelpTooltip />
        {(["complete", "partial", "critical"] as const).map((status) => {
          const badge = getStatusBadge(status);
          return (
            <span
              key={status}
              className={`rounded-full border px-2.5 py-1 font-semibold ${badge.className}`}
            >
              {badge.label}
            </span>
          );
        })}
        <span aria-hidden className="text-zinc-300 dark:text-zinc-600">
          |
        </span>
        {getAttachmentBadges({ hasPayments: false, hasDentalRecords: false, isEmptyShell: true })
          .filter((badge) => badge.key === "empty")
          .map((badge) => (
            <span
              key={badge.key}
              className={`rounded-full border px-2.5 py-1 font-semibold ${badge.className}`}
            >
              Vuota
            </span>
          ))}
        {getAttachmentBadges({ hasPayments: true, hasDentalRecords: false, isEmptyShell: false })
          .filter((badge) => badge.key !== "empty")
          .map((badge) => (
            <span
              key={badge.key}
              className={`rounded-full border px-2.5 py-1 font-semibold ${badge.className}`}
            >
              {badge.label}
            </span>
          ))}
      </div>

      {groups.length === 0 ? (
        <section className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-5 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:text-emerald-200">
          {hasSearch
            ? `Nessun duplicato trovato per "${searchQuery}".`
            : "Nessun duplicato potenziale trovato con i controlli su codice fiscale, email, telefono o nome con data di nascita."}
        </section>
      ) : (
        <div className="space-y-4">
          {groups.map((group, index) => {
            const classification = classificationByGroupId.get(group.id);
            const keepPatientId = classification?.keepPatientId;
            const isSafe = Boolean(classification?.safe);
            const patientIds = group.patients.map((p) => p.id);
            const nonEmptyCount = countNonEmptyPatients(patientIds, fullCounts);
            const conflicts = getDuplicateFieldConflicts(group.patients);
            const reviewKind = getReviewGroupKind({
              safe: isSafe,
              nonEmptyCount,
              conflicts,
            });
            const guidance = groupGuidance(reviewKind);
            const matchSummary = matchReasonSummary(group.matchSignals.map((s) => s.kind));
            const filledPreview =
              isSafe && keepPatientId
                ? (() => {
                    const keeper = toMergeSnapshot(keepPatientId);
                    const losers = classification!.deletePatientIds
                      .map((id) => toMergeSnapshot(id))
                      .filter((item): item is MergePatientSnapshot => Boolean(item));
                    if (!keeper) return [] as string[];
                    return buildFieldFillPlan(keeper, losers).filledFields;
                  })()
                : [];

            return (
            <section
              key={group.id}
              className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Gruppo {index + 1}
                </p>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {group.patients.length} schede
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {[matchSummary, isSafe ? "Puoi unire le schede vuote" : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {guidance ? (
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                    {guidance}
                  </p>
                ) : null}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                {group.patients.map((patient) => {
                  const displayName =
                    `${(patient.lastName ?? "").trim()} ${(patient.firstName ?? "").trim()}`.trim() || "Paziente senza nome";
                  const missingFields = getPatientMissingFields(patient);
                  const status = getPatientStatus(missingFields.length);
                  const attachmentFlags =
                    attachmentFlagsByPatientId.get(patient.id) ?? {
                      hasPayments: false,
                      hasDentalRecords: false,
                      isEmptyShell: false,
                    };
                  const attachmentBadges = getAttachmentBadges(attachmentFlags);
                  const createdInfo = createdInfoByPatientId.get(patient.id);
                  const createdAtLabel = formatCreatedAt(
                    createdInfo?.createdAt ?? patient.createdAt,
                    displayTimeZone,
                  );
                  const createdByLabel = createdInfo?.createdBy ?? "Origine non tracciata";
                  const isSuggestedKeeper = keepPatientId === patient.id;
                  const otherIds = group.patients
                    .map((groupPatient) => groupPatient.id)
                    .filter((id) => id !== patient.id);
                  const allowHardDeleteOthers =
                    user.role === Role.ADMIN &&
                    canHardDeleteOthers(otherIds, fullCounts);
                  const isEmptyShell = attachmentFlags.isEmptyShell;

                  return (
                    <div
                      key={patient.id}
                      className={`rounded-lg border p-4 transition ${getCardClassName(status, isSafe)}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{displayName}</h3>
                          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            ID {patient.id}
                          </p>
                          {isSafe && isSuggestedKeeper ? (
                            <span className="mt-2 inline-flex rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                              Consigliata da mantenere
                            </span>
                          ) : null}
                          {attachmentBadges.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {attachmentBadges.map((badge) => (
                                <span
                                  key={`${patient.id}-${badge.key}`}
                                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}
                                >
                                  {badge.label}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {isSafe &&
                          isSuggestedKeeper &&
                          user.role === Role.ADMIN &&
                          classification ? (
                            <PatientDuplicateMergeButton
                              keepPatientId={patient.id}
                              deletePatientIds={classification.deletePatientIds}
                              filledFieldsPreview={filledPreview}
                            />
                          ) : null}
                          {!isSafe &&
                          isSuggestedKeeper &&
                          allowHardDeleteOthers &&
                          user.role === Role.ADMIN ? (
                            <PatientDuplicateResolveButton
                              keepPatientId={patient.id}
                              duplicatePatientIds={otherIds}
                            />
                          ) : null}
                          {!isSafe &&
                          isEmptyShell &&
                          user.role === Role.ADMIN ? (
                            <PatientDeleteButton patientId={patient.id} role={user.role} redirectTo={null} />
                          ) : null}
                          <Link
                            href={`/pazienti/${patient.id}`}
                            className="rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                          >
                            Apri scheda
                          </Link>
                        </div>
                      </div>

                      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm text-zinc-700 dark:text-zinc-300 sm:grid-cols-2">
                        {(
                          [
                            ["email", "Email"],
                            ["phone", "Telefono"],
                            ["birthDate", "Data di nascita"],
                            ["taxId", "Codice fiscale"],
                          ] as const
                        ).map(([field, label]) => {
                          const isConflict = conflicts.some((c) => c.field === field);
                          return (
                            <div key={field}>
                              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                {label}
                              </dt>
                              <dd
                                className={`mt-1 ${field === "email" || field === "taxId" ? "break-all" : ""} ${
                                  isConflict
                                    ? "font-semibold text-rose-800 dark:text-rose-300"
                                    : ""
                                }`}
                              >
                                {fieldDisplayValue(field, patient)}
                              </dd>
                            </div>
                          );
                        })}
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Creata il</dt>
                          <dd className="mt-1">{createdAtLabel}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Creata da</dt>
                          <dd className="mt-1">{createdByLabel}</dd>
                        </div>
                      </dl>

                      {missingFields.length > 0 ? (
                        <div className="mt-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Campi mancanti
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {missingFields.map((field) => (
                              <span
                                key={field}
                                className="rounded-full border border-zinc-300 bg-white/70 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200"
                              >
                                {field}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
