import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { Role, Gender } from "@prisma/client";
import { PrintButton } from "@/components/print-button";
import { ASSISTANT_ROLE } from "@/lib/roles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stamap scheda",
};

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

export default async function PatientPrintPage({
  params,
}: {
  params: Promise<{ id?: string }>;
}) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  await requireFeatureAccess(user.role, "patients");
  const resolvedParams = await params;
  const patientId = resolvedParams?.id;
  if (!patientId) {
    return notFound();
  }

  const [patient, dentalRecords, implants, pastAppointments] = await Promise.all([
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

  return (
    <div className="min-h-screen bg-zinc-100 px-6 py-8 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm print:max-w-none print:border-none print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-6 print:pb-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-40 rounded-lg bg-white p-2">
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
              <h1 className="text-2xl font-semibold text-zinc-900">Studio Agovino & Angrisano</h1>
            </div>
          </div>
          <PrintButton
            className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600 print:hidden"
            label="Stampa scheda paziente"
          />
        </div>

        <div className="grid gap-4 text-sm text-zinc-700 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Paziente</p>
            <p className="mt-2 text-base font-semibold text-zinc-900">
              {patient.lastName} {patient.firstName}
            </p>
            <p className="text-xs text-zinc-600">{patient.email ?? "—"}</p>
            <p className="text-xs text-zinc-600">{patient.phone ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Dettagli</p>
            <p className="mt-2 text-sm text-zinc-800">
              Data di nascita:{" "}
              {patient.birthDate
                ? new Date(patient.birthDate).toLocaleDateString("it-IT", { dateStyle: "short" })
                : "—"}
            </p>
            <p className="text-sm text-zinc-800">Genere: {formatGender(patient.gender)}</p>
            <p className="text-sm text-zinc-800">Codice fiscale: {parsedTaxId || "—"}</p>
          </div>
        </div>

        <div className="grid gap-4 text-sm text-zinc-700 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Indirizzo</p>
            <p className="mt-2 text-sm text-zinc-800">{parsedAddress || "—"}</p>
            <p className="text-sm text-zinc-800">{parsedCity || "—"}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Anamnesi generale
            </p>
            <p className="mt-2 text-sm text-zinc-800">
              {parsedConditions.length ? parsedConditions.join(", ") : "—"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 text-sm text-zinc-700 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Farmaci e dosaggi
            </p>
            <p className="mt-2 text-sm text-zinc-800">{parsedMedications || "—"}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Note</p>
            <p className="mt-2 text-sm text-zinc-800">{parsedExtra || "—"}</p>
          </div>
        </div>

        <div className="border-t border-zinc-200 pt-6">
          <h2 className="text-lg font-semibold text-zinc-900">Diario clinico</h2>
          {dentalRecords.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">Nessun record clinico disponibile.</p>
          ) : (
            <div className="mt-4 relative overflow-x-auto rounded-2xl border border-zinc-200">
              <table className="min-w-full divide-y divide-zinc-100 text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-4 py-3 text-left">Data</th>
                    <th className="px-4 py-3 text-left">Dente</th>
                    <th className="px-4 py-3 text-left">Procedura</th>
                    <th className="px-4 py-3 text-left">Note</th>
                    <th className="px-4 py-3 text-left">Trattato</th>
                    <th className="px-4 py-3 text-left">Aggiornato da</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {dentalRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="px-4 py-3">
                        {new Date(record.performedAt).toLocaleString("it-IT", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        {record.tooth === 0 ? "Tutta la bocca" : `Dente ${record.tooth}`}
                      </td>
                      <td className="px-4 py-3">{record.procedure}</td>
                      <td className="px-4 py-3">{record.notes ?? "—"}</td>
                      <td className="px-4 py-3">{record.treated ? "Si" : "No"}</td>
                      <td className="px-4 py-3">
                        {record.updatedBy?.name ?? record.updatedBy?.email ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-200 pt-6">
          <h2 className="text-lg font-semibold text-zinc-900">Impianti</h2>
          {implants.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">Nessun impianto associato.</p>
          ) : (
            <div className="mt-4 relative overflow-x-auto rounded-2xl border border-zinc-200">
              <table className="min-w-full divide-y divide-zinc-100 text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-4 py-3 text-left">Data</th>
                    <th className="px-4 py-3 text-left">Prodotto</th>
                    <th className="px-4 py-3 text-left">Marca</th>
                    <th className="px-4 py-3 text-left">UDI-DI</th>
                    <th className="px-4 py-3 text-left">UDI-PI</th>
                    <th className="px-4 py-3 text-left">Fornitore</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {implants.map((imp) => (
                    <tr key={imp.id}>
                      <td className="px-4 py-3">
                        {new Date(imp.createdAt).toLocaleString("it-IT", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-4 py-3">{imp.product?.name ?? "—"}</td>
                      <td className="px-4 py-3">{imp.brand ?? "—"}</td>
                      <td className="px-4 py-3">{imp.udiDi ?? "—"}</td>
                      <td className="px-4 py-3">{imp.udiPi ?? "—"}</td>
                      <td className="px-4 py-3">{imp.product?.supplier?.name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-200 pt-6">
          <h2 className="text-lg font-semibold text-zinc-900">Appuntamenti passati</h2>
          {pastAppointments.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">Nessun appuntamento passato.</p>
          ) : (
            <div className="mt-4 relative overflow-x-auto rounded-2xl border border-zinc-200">
              <table className="min-w-full divide-y divide-zinc-100 text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-4 py-3 text-left">Data</th>
                    <th className="px-4 py-3 text-left">Servizio</th>
                    <th className="px-4 py-3 text-left">Medico</th>
                    <th className="px-4 py-3 text-left">Stato</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {pastAppointments.map((appt) => (
                    <tr key={appt.id}>
                      <td className="px-4 py-3">
                        {new Date(appt.startsAt).toLocaleString("it-IT", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-4 py-3">{appt.serviceType ?? "—"}</td>
                      <td className="px-4 py-3">{appt.doctor?.fullName ?? "—"}</td>
                      <td className="px-4 py-3">{appt.status ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="border-t border-zinc-200 pt-4 text-xs text-zinc-500">
          Data stampa: {new Date().toLocaleDateString("it-IT", { dateStyle: "short" })} · Operatore:{" "}
          {user.name ?? user.email ?? "—"}
        </div>
      </div>
    </div>
  );
}
