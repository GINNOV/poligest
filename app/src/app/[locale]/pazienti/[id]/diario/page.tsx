import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { Role } from "@prisma/client";
import { PrintButton } from "@/components/print-button";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { getUserDisplayTimeZone } from "@/lib/user-display-time-zone.server";
import { formatDateInDisplayTimeZone } from "@/lib/user-display-time-zone";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stampa diario",
};

export default async function DiarioPrintPage({
  params,
}: {
  params: Promise<{ id?: string }>;
}) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  await requireFeatureAccess(user.role, "clinical-records");
  const displayTimeZone = await getUserDisplayTimeZone();
  const resolvedParams = await params;
  const patientId = resolvedParams?.id;
  if (!patientId) {
    return notFound();
  }

  const [patient, records] = await Promise.all([
    prisma.patient.findUnique({
      where: { id: patientId },
      select: { firstName: true, lastName: true, email: true, phone: true },
    }),
    prisma.dentalRecord.findMany({
      where: { patientId },
      orderBy: { performedAt: "desc" },
      include: { updatedBy: { select: { name: true } } },
    }),
  ]);

  if (!patient) {
    return notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-100 px-6 py-8 dark:bg-zinc-900 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 print:max-w-none print:border-none print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800 print:pb-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-40 rounded-lg bg-white p-2 dark:bg-white/90">
              <Image
                src="/logo/studio_agovinoangrisano_logo.png"
                alt="Logo Studio Agovino & Angrisano"
                width={320}
                height={120}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
                Diario clinico
              </p>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Studio Agovino & Angrisano</h1>
            </div>
          </div>
          <PrintButton
            label="Stampa diario"
            variant="primary"
            className="print:hidden"
          />
        </div>

        <div className="grid gap-4 text-sm text-zinc-700 dark:text-zinc-300 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Paziente</p>
            <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {patient.lastName} {patient.firstName}
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">{patient.email ?? "—"}</p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">{patient.phone ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Dettagli</p>
            <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">
              Record clinici: {records.length}
            </p>
            <p className="text-sm text-zinc-800 dark:text-zinc-200">
              Data stampa: {formatDateInDisplayTimeZone(new Date(), { dateStyle: "short" }, displayTimeZone)}
            </p>
          </div>
        </div>

        {records.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            Nessun record clinico disponibile.
          </div>
        ) : (
          <div className="relative overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white/90 to-transparent sm:hidden dark:from-zinc-950/90" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white/90 to-transparent sm:hidden dark:from-zinc-950/90" />
            <table className="min-w-full divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">Dente</th>
                  <th className="px-4 py-3 text-left">Procedura</th>
                  <th className="px-4 py-3 text-left">Note</th>
                  <th className="px-4 py-3 text-left">Trattato</th>
                  <th className="px-4 py-3 text-left">Aggiornato da</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {formatDateInDisplayTimeZone(
                        new Date(record.performedAt),
                        {
                          dateStyle: "short",
                          timeStyle: "short",
                        },
                        displayTimeZone
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                      {record.tooth === 0 ? "Tutta la bocca" : `Dente ${record.tooth}`}
                    </td>
                    <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200">{record.procedure}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{record.notes ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${record.treated ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                        {record.treated ? "Si" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{record.updatedBy?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
