import Link from "next/link";
import type { Metadata } from "next";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { prisma } from "@/lib/prisma";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { formatPhone } from "@/lib/phone";
import { findPotentialPatientDuplicates } from "@/lib/patients/duplicate-detection";
import { PatientDuplicateResolveButton } from "@/components/patient-duplicate-resolve-button";

export const metadata: Metadata = {
  title: "CERCA DUPLICATI",
};

type PatientDuplicateStatus = "complete" | "partial" | "critical";

function formatBirthDate(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function formatSignalValue(kind: "taxId" | "email" | "phone" | "nameBirthDate", value: string) {
  if (kind === "phone") {
    return formatPhone(value);
  }
  if (kind === "nameBirthDate") {
    const [lastName, firstName, birthDate] = value.split("|");
    const displayName = [firstName, lastName].filter(Boolean).join(" ").trim();
    return `${displayName} · ${birthDate}`;
  }
  return value;
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

function getCardClassName(status: PatientDuplicateStatus) {
  switch (status) {
    case "complete":
      return "border-emerald-200 bg-emerald-50/70 hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/30";
    case "partial":
      return "border-amber-200 bg-amber-50/70 hover:border-amber-300 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 dark:hover:border-amber-800 dark:hover:bg-amber-950/30";
    case "critical":
      return "border-rose-200 bg-rose-50/70 hover:border-rose-300 hover:bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20 dark:hover:border-rose-800 dark:hover:bg-rose-950/30";
  }
}

export default async function PazientiDuplicatiPage() {
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
      notes: true,
      createdAt: true,
    },
  });

  const groups = findPotentialPatientDuplicates(patients);
  const totalPatients = new Set(groups.flatMap((group) => group.patients.map((patient) => patient.id))).size;

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
          <div className="font-semibold">{groups.length} gruppi trovati</div>
          <div>{totalPatients} pazienti coinvolti</div>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Legenda stato schede</h2>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {(["complete", "partial", "critical"] as const).map((status) => {
              const badge = getStatusBadge(status);
              return (
                <span
                  key={status}
                  className={`rounded-full border px-3 py-1 font-semibold ${badge.className}`}
                >
                  {badge.label}
                </span>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Il colore della scheda cambia in base a quanti dati chiave mancano: email, telefono, data di nascita e codice fiscale.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Come funziona il controllo</h2>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            La ricerca segnala gruppi che condividono almeno uno tra codice fiscale, email, telefono oppure la combinazione di nome, cognome e data di nascita.
          </p>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Apri le schede del gruppo, scegli quella piu completa come riferimento, trasferisci eventuali dati mancanti e poi valuta se tenere una sola scheda operativa per evitare errori su agenda, richiami e consensi.
          </p>
        </div>
      </section>

      {groups.length === 0 ? (
        <section className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-5 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:text-emerald-200">
          Nessun duplicato potenziale trovato con i controlli su codice fiscale, email, telefono o nome con data di nascita.
        </section>
      ) : (
        <div className="space-y-4">
          {groups.map((group, index) => (
            <section
              key={group.id}
              className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Gruppo {index + 1}
                  </p>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {group.patients.length} schede da verificare
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.matchSignals.map((signal) => (
                    <span
                      key={`${signal.kind}:${signal.value}`}
                      className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
                    >
                      {signal.label}: {formatSignalValue(signal.kind, signal.value)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                {group.patients.map((patient) => {
                  const displayName =
                    `${(patient.lastName ?? "").trim()} ${(patient.firstName ?? "").trim()}`.trim() || "Paziente senza nome";
                  const missingFields = getPatientMissingFields(patient);
                  const status = getPatientStatus(missingFields.length);

                  return (
                    <div
                      key={patient.id}
                      className={`rounded-lg border p-4 transition ${getCardClassName(status)}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{displayName}</h3>
                          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            ID {patient.id}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {status === "complete" && user.role === Role.ADMIN ? (
                            <PatientDuplicateResolveButton
                              keepPatientId={patient.id}
                              duplicatePatientIds={group.patients
                                .map((groupPatient) => groupPatient.id)
                                .filter((groupPatientId) => groupPatientId !== patient.id)}
                            />
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
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Email</dt>
                          <dd className="mt-1 break-all">{patient.email ?? "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Telefono</dt>
                          <dd className="mt-1">{formatPhone(patient.phone)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Data di nascita</dt>
                          <dd className="mt-1">{formatBirthDate(patient.birthDate)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Codice fiscale</dt>
                          <dd className="mt-1 break-all">{patient.taxId ?? "—"}</dd>
                        </div>
                      </dl>

                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          Campi mancanti
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {missingFields.length > 0 ? (
                            missingFields.map((field) => (
                              <span
                                key={field}
                                className="rounded-full border border-zinc-300 bg-white/70 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200"
                              >
                                {field}
                              </span>
                            ))
                          ) : (
                            <span className="rounded-full border border-emerald-200 bg-white/70 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-900/40 dark:bg-zinc-900/60 dark:text-emerald-200">
                              Nessun dato chiave mancante
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
