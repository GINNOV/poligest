import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { Role } from "@prisma/client";
import { PrintButton } from "@/components/print-button";
import { ASSISTANT_ROLE } from "@/lib/roles";

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
                Diario clinico
              </p>
              <h1 className="text-2xl font-semibold text-zinc-900">Studio Agovino & Angrisano</h1>
            </div>
          </div>
          <PrintButton
            className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600 print:hidden"
            label="Stampa diario"
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
              Record clinici: {records.length}
            </p>
            <p className="text-sm text-zinc-800">
              Data stampa: {new Date().toLocaleDateString("it-IT", { dateStyle: "short" })}
            </p>
          </div>
        </div>

        {records.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            Nessun record clinico disponibile.
          </div>
        ) : (
          <div className="relative overflow-x-auto rounded-2xl border border-zinc-200">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white/90 to-transparent sm:hidden" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white/90 to-transparent sm:hidden" />
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
                {records.map((record) => (
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
                    <td className="px-4 py-3">{record.updatedBy?.name ?? "—"}</td>
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
