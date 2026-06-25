import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { Role, Gender } from "@prisma/client";
import { PrintButton } from "@/components/print-button";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { getUserDisplayTimeZone } from "@/lib/user-display-time-zone.server";
import { formatDateInDisplayTimeZone } from "@/lib/user-display-time-zone";
import { formatAuditActor } from "@/lib/audit";
import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";

export const revalidate = 60;

export const metadata = createPageMetadata(PAGE_TITLES.stampaScheda);

const formatGender = (gender: Gender | null) => {
  switch (gender) {
    case Gender.FEMALE:
      return "Femmina";
    case Gender.MALE:
      return "Maschio";
    case Gender.OTHER:
      return "Altro";
    default:
      return "Non specificato";
  }
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

export default async function PatientPrintPage({
  params,
}: {
  params: Promise<{ id?: string }>;
}) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  await requireFeatureAccess(user.role, "patients");
  const displayTimeZone = await getUserDisplayTimeZone();
  const resolvedParams = await params;
  const patientId = resolvedParams?.id;
  if (!patientId) {
    return notFound();
  }

  const [patient, dentalRecords, implants, pastAppointments, createdLog, updatedLog] = await Promise.all([
    prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        birthDate: true,
        gender: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.dentalRecord.findMany({
      where: { patientId },
      orderBy: { performedAt: "desc" },
      include: { updatedBy: { select: { name: true, email: true } } },
    }),
    prisma.stockMovement.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      include: { product: { include: { supplier: true } } },
    }),
    prisma.appointment.findMany({
      where: { patientId, startsAt: { lt: new Date() } },
      orderBy: { startsAt: "desc" },
      include: { doctor: { select: { fullName: true } } },
    }),
    prisma.auditLog.findFirst({
      where: {
        entity: "Patient",
        entityId: patientId,
        action: "patient.created",
      },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.findFirst({
      where: {
        entity: "Patient",
        entityId: patientId,
        action: {
          notIn: [
            "patient.created",
            "patient.access_email_sent",
            "patient.whatsapp_reminder_sent",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  if (!patient) {
    return notFound();
  }

  const notesLines = (patient.notes ?? "").split("\n").map((line) => line.trim());
  const addressLine = notesLines.find((line) => line.startsWith("Indirizzo:"));
  const addressPayload = addressLine?.replace("Indirizzo:", "").trim() ?? "";
  const addressSeparatorIndex = addressPayload.lastIndexOf(",");
  const parsedAddressRaw =
    addressSeparatorIndex >= 0 ? addressPayload.slice(0, addressSeparatorIndex).trim() : addressPayload;
  const parsedCityRaw =
    addressSeparatorIndex >= 0 ? addressPayload.slice(addressSeparatorIndex + 1).trim() : "";
  const parsedAddress = parsedAddressRaw === "—" ? "" : parsedAddressRaw;
  const parsedCity = parsedCityRaw === "—" ? "" : parsedCityRaw;
  const taxIdLine = notesLines.find((line) => line.startsWith("Codice Fiscale:"));
  const parsedTaxId = taxIdLine?.replace("Codice Fiscale:", "").trim() ?? "";
  const anamnesisLine = notesLines.find((line) => line.startsWith("Anamnesi:"));
  const parsedConditions = anamnesisLine
    ? anamnesisLine
        .replace("Anamnesi:", "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
    : [];
  const medicationsLine = notesLines.find((line) => line.startsWith("Farmaci:"));
  const parsedMedications = medicationsLine?.replace("Farmaci:", "").trim() ?? "";
  const extraLine = notesLines.find(
    (line) => line.startsWith("Note aggiuntive:") || line.startsWith("Note:")
  );
  const parsedExtra = extraLine
    ? extraLine.replace("Note aggiuntive:", "").replace("Note:", "").trim()
    : "";
  const createdBy = formatAuditActor(createdLog);
  const updatedBy = updatedLog ? formatAuditActor(updatedLog) : createdBy;
  const createdAtLabel = formatDateTime(createdLog?.createdAt ?? patient.createdAt, displayTimeZone);
  const updatedAtLabel = formatDateTime(updatedLog?.createdAt ?? patient.updatedAt, displayTimeZone);

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900 px-6 py-8 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 shadow-sm print:max-w-none print:border-none print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6 print:pb-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-40 rounded-lg bg-white dark:bg-zinc-950 p-2">
              <Image
                src="/logo/studio_agovinoangrisano_logo.png"
                alt="Logo Studio Agovino & Angrisano"
                width={320}
                height={120}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Scheda paziente
              </p>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Studio Agovino & Angrisano</h1>
            </div>
          </div>
          <PrintButton
            label="Stampa scheda paziente"
            variant="primary"
            className="print:hidden"
          />
        </div>

        <div className="grid gap-4 text-sm text-zinc-700 dark:text-zinc-300 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Paziente</p>
            <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {patient.lastName} {patient.firstName}
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">{patient.email ?? "—"}</p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">{patient.phone ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Dettagli</p>
            <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">
              Data di nascita:{" "}
              {patient.birthDate
                ? formatDateInDisplayTimeZone(
                    new Date(patient.birthDate),
                    { dateStyle: "short" },
                    displayTimeZone
                  )
                : "—"}
            </p>
            <p className="text-sm text-zinc-800 dark:text-zinc-200">Genere: {formatGender(patient.gender)}</p>
            <p className="text-sm text-zinc-800 dark:text-zinc-200">Codice fiscale: {parsedTaxId || "—"}</p>
          </div>
        </div>

        <div className="grid gap-4 text-sm text-zinc-700 dark:text-zinc-300 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Indirizzo</p>
            <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">{parsedAddress || "—"}</p>
            <p className="text-sm text-zinc-800 dark:text-zinc-200">{parsedCity || "—"}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Anamnesi generale
            </p>
            <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">
              {parsedConditions.length ? parsedConditions.join(", ") : "—"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 text-sm text-zinc-700 dark:text-zinc-300 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Farmaci e dosaggi
            </p>
            <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">{parsedMedications || "—"}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Note</p>
            <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">{parsedExtra || "—"}</p>
          </div>
        </div>

        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Diario clinico</h2>
          {dentalRecords.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Nessun record clinico disponibile.</p>
          ) : (
            <div className="mt-4 relative overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Data</th>
                    <th className="px-4 py-3 text-left">Dente</th>
                    <th className="px-4 py-3 text-left">Procedura</th>
                    <th className="px-4 py-3 text-left">Note</th>
                    <th className="px-4 py-3 text-left">Trattato</th>
                    <th className="px-4 py-3 text-left">Aggiornato da</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {dentalRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {formatDateInDisplayTimeZone(
                          new Date(record.performedAt),
                          {
                            dateStyle: "short",
                            timeStyle: "short",
                          },
                          displayTimeZone
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {record.tooth === 0 ? "Tutta la bocca" : `Dente ${record.tooth}`}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{record.procedure}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{record.notes ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{record.treated ? "Si" : "No"}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {record.updatedBy?.name ?? record.updatedBy?.email ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Impianti</h2>
          {implants.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Nessun impianto associato.</p>
          ) : (
            <div className="mt-4 relative overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Data</th>
                    <th className="px-4 py-3 text-left">Prodotto</th>
                    <th className="px-4 py-3 text-left">Marca</th>
                    <th className="px-4 py-3 text-left">UDI-DI</th>
                    <th className="px-4 py-3 text-left">UDI-PI</th>
                    <th className="px-4 py-3 text-left">Fornitore</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {implants.map((imp) => (
                    <tr key={imp.id}>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {formatDateInDisplayTimeZone(
                          new Date(imp.createdAt),
                          {
                            dateStyle: "short",
                            timeStyle: "short",
                          },
                          displayTimeZone
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{imp.product?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{imp.product?.brand ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{imp.product?.udiDi ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{imp.udiPi ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{imp.product?.supplier?.name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Appuntamenti passati</h2>
          {pastAppointments.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Nessun appuntamento passato.</p>
          ) : (
            <div className="mt-4 relative overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Data</th>
                    <th className="px-4 py-3 text-left">Servizio</th>
                    <th className="px-4 py-3 text-left">Medico</th>
                    <th className="px-4 py-3 text-left">Stato</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {pastAppointments.map((appt) => (
                    <tr key={appt.id}>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {formatDateInDisplayTimeZone(
                          new Date(appt.startsAt),
                          {
                            dateStyle: "short",
                            timeStyle: "short",
                          },
                          displayTimeZone
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{appt.serviceType ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{appt.doctor?.fullName ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{appt.status ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
          <h2 className="text-lg font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-50">
            Storico scheda
          </h2>
          <div className="mt-4 grid gap-4 text-sm text-zinc-700 dark:text-zinc-300 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Creata il
              </p>
              <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">{createdAtLabel}</p>
              <p className="text-sm text-zinc-800 dark:text-zinc-200">Da: {createdBy}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Ultimo aggiornamento
              </p>
              <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">{updatedAtLabel}</p>
              <p className="text-sm text-zinc-800 dark:text-zinc-200">Da: {updatedBy}</p>
            </div>
          </div>
        </div>
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 text-xs text-zinc-500 dark:text-zinc-400">
          Data stampa: {formatDateInDisplayTimeZone(new Date(), { dateStyle: "short" }, displayTimeZone)} · Operatore:{" "}
          {user.name ?? user.email ?? "—"}
        </div>
      </div>
    </div>
  );
}
