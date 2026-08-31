/* eslint-disable @next/next/no-img-element */
import Image from "next/image";
import { notFound } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { PrintButton } from "@/components/print-button";
import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";

export const metadata = createPageMetadata(PAGE_TITLES.stampaCertificato);

const renderInline = (text: string) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((segment, idx) => {
    if (segment.startsWith("**") && segment.endsWith("**")) {
      return (
        <strong key={idx} className="font-semibold text-zinc-900 dark:text-zinc-50">
          {segment.slice(2, -2)}
        </strong>
      );
    }
    return <span key={idx}>{segment}</span>;
  });

export default async function CertificatePrintPage({
  params,
}: {
  params: Promise<{ id?: string; certificateId?: string }>;
}) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  await requireFeatureAccess(user.role, "patients");

  const resolved = await params;
  const patientId = resolved?.id;
  const certificateId = resolved?.certificateId;

  if (!patientId || !certificateId) {
    return notFound();
  }

  const cert = await prisma.medicalCertificate.findUnique({
    where: { id: certificateId },
    include: {
      patient: true,
      doctor: true,
    },
  });

  if (!cert || cert.patientId !== patientId) {
    return notFound();
  }

  const patientName = `${cert.patient.lastName} ${cert.patient.firstName}`.trim();
  const birthDateStr = cert.patient.birthDate
    ? new Date(cert.patient.birthDate).toLocaleDateString("it-IT")
    : null;

  const paragraphs = cert.content.split(/\r?\n\r?\n/);

  return (
    <div className="min-h-screen bg-zinc-100 px-6 py-8 dark:bg-zinc-900 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-3xl space-y-8 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 print:max-w-none print:border-none print:p-0 print:shadow-none">
        
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800 print:pb-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-44 rounded-lg bg-white p-2 dark:bg-white/90">
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
                Certificazione Sanitaria
              </p>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                Studio Medico Odontoiatrico
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Dott. Agovino & Angrisano · San Valentino Torio (SA)
              </p>
            </div>
          </div>
          <PrintButton label="Stampa Certificato" variant="primary" className="print:hidden" />
        </div>

        {/* Certificate Metadata Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
          <div>
            <span className="font-semibold text-zinc-500 dark:text-zinc-400">ID Certificato: </span>
            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-50">
              {cert.certificateNumber}
            </span>
            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              Versione {cert.version}
            </span>
          </div>
          <div className="text-right text-zinc-600 dark:text-zinc-300">
            <span>{cert.place}, </span>
            <span className="font-semibold">
              {new Date(cert.issuedAt).toLocaleDateString("it-IT", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Patient Box */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 text-sm text-emerald-950 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
            Intestato al Paziente
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <span className="font-semibold">Nominativo:</span> {patientName}
            </div>
            <div>
              <span className="font-semibold">Codice Fiscale:</span> {cert.patient.taxId || "—"}
            </div>
            {birthDateStr ? (
              <div>
                <span className="font-semibold">Data di Nascita:</span> {birthDateStr}
              </div>
            ) : null}
            {cert.patient.phone ? (
              <div>
                <span className="font-semibold">Recapito:</span> {cert.patient.phone}
              </div>
            ) : null}
          </div>
        </div>

        {/* Certificate Title */}
        <div className="text-center">
          <h2 className="text-lg font-bold uppercase tracking-wide text-zinc-900 underline decoration-emerald-500 decoration-2 underline-offset-8 dark:text-zinc-50">
            {cert.title}
          </h2>
        </div>

        {/* Certificate Body */}
        <div className="space-y-4 text-justify text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
          {paragraphs.map((para, idx) => (
            <p key={idx}>{renderInline(para)}</p>
          ))}
        </div>

        {/* Prognosis Summary Box if present */}
        {cert.prognosisDays || cert.startDate ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
              Riepilogo Prognosi Clinica
            </p>
            <div className="mt-2 flex flex-wrap gap-6 text-sm">
              {cert.prognosisDays ? (
                <div>
                  <span className="text-xs text-zinc-500">Giorni prescritti: </span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-50">
                    {cert.prognosisDays} giorni
                  </span>
                </div>
              ) : null}
              {cert.startDate ? (
                <div>
                  <span className="text-xs text-zinc-500">Dal: </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {new Date(cert.startDate).toLocaleDateString("it-IT")}
                  </span>
                </div>
              ) : null}
              {cert.endDate ? (
                <div>
                  <span className="text-xs text-zinc-500">Al: </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {new Date(cert.endDate).toLocaleDateString("it-IT")}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Doctor Signature & Stamp */}
        <div className="flex flex-col items-end gap-2 pt-6">
          <div className="w-64 text-center">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Il Medico Chirurgo Odontoiatra
            </p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {cert.doctorName}
            </p>

            <div className="my-2 flex h-24 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900 print:border-none">
              {cert.signatureUrl ? (
                <img
                  src={cert.signatureUrl}
                  alt="Firma Digitale"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-xs italic text-zinc-400">Firma autografa</span>
              )}
            </div>

            {cert.signatureUrl ? (
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
                Documento firmato digitalmente
              </p>
            ) : null}
          </div>
        </div>

        {/* Footer info */}
        <div className="border-t border-zinc-200 pt-4 text-center text-[10px] text-zinc-400 dark:border-zinc-800 print:pt-6">
          Certificato rilasciato ai sensi delle vigenti disposizioni di legge · Conservare per usi amministrativi e previdenziali.
        </div>
      </div>
    </div>
  );
}
