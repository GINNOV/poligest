import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { ConsentStatus, Role } from "@prisma/client";
import { PrintButton } from "@/components/print-button";
import { ASSISTANT_ROLE } from "@/lib/roles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stampa consensi",
};

const consentStatusLabels: Record<ConsentStatus, string> = {
  GRANTED: "Concesso",
  REVOKED: "Revocato",
  EXPIRED: "Scaduto",
};

export default async function ConsensiPrintPage({
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

  const [patient, consents] = await Promise.all([
    prisma.patient.findUnique({
      where: { id: patientId },
      select: { firstName: true, lastName: true, email: true, phone: true },
    }),
    prisma.patientConsent.findMany({
      where: { patientId },
      orderBy: { givenAt: "desc" },
      include: { module: true },
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
                Consensi & privacy
              </p>
              <h1 className="text-2xl font-semibold text-zinc-900">Studio Agovino & Angrisano</h1>
            </div>
          </div>
          <PrintButton
            className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600 print:hidden"
            label="Stampa consensi"
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
              Consensi registrati: {consents.length}
            </p>
            <p className="text-sm text-zinc-800">
              Data stampa: {new Date().toLocaleDateString("it-IT", { dateStyle: "short" })}
            </p>
          </div>
        </div>

        {consents.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            Nessun consenso registrato.
          </div>
        ) : (
          <div className="space-y-4">
            {consents.map((consent) => {
              const signatureUrl = (consent as { signatureUrl?: string | null }).signatureUrl;
              return (
                <div
                  key={consent.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase text-emerald-800">
                    <span className="rounded-full bg-emerald-50 px-3 py-1">
                      {consent.module?.name ?? "Modulo"}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-zinc-600">
                      {consentStatusLabels[consent.status] ?? consent.status}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 text-sm text-zinc-700 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p>Data consenso: {new Date(consent.givenAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}</p>
                      <p>Canale: {consent.channel ?? "—"}</p>
                      <p>Luogo: {consent.place ?? "—"}</p>
                      <p>Scadenza: {consent.expiresAt ? new Date(consent.expiresAt).toLocaleDateString("it-IT") : "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p>Firma paziente: {consent.patientName ?? "—"}</p>
                      <p>Firma medico: {consent.doctorName ?? "—"}</p>
                      <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-500">
                        {signatureUrl ? (
                          <img
                            src={signatureUrl}
                            alt="Firma digitale"
                            className="h-16 w-auto max-w-full"
                          />
                        ) : (
                          "Firma digitale non disponibile."
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
