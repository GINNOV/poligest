import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { PrintButton } from "@/components/print-button";
import { ASSISTANT_ROLE } from "@/lib/roles";

const renderInline = (text: string) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((segment, idx) => {
    if (segment.startsWith("**") && segment.endsWith("**")) {
      return (
        <strong key={idx} className="font-semibold text-zinc-900">
          {segment.slice(2, -2)}
        </strong>
      );
    }
    return <span key={idx}>{segment}</span>;
  });

const renderMarkdown = (markdown: string) => {
  const cleaned = markdown.replace(/\\([#*`>\\-])/g, "$1");
  const lines = cleaned.split(/\r?\n/);
  const nodes: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];

  const flushList = () => {
    if (list.length > 0) {
      nodes.push(
        <ul key={`list-${nodes.length}`} className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-zinc-800">
          {list}
        </ul>,
      );
      list = [];
    }
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) {
      flushList();
      return;
    }

    if (line.startsWith("# ")) {
      flushList();
      nodes.push(
        <h3 key={`h1-${idx}`} className="text-base font-semibold text-zinc-900">
          {line.replace(/^#\s+/, "")}
        </h3>,
      );
      return;
    }

    if (line.startsWith("## ")) {
      flushList();
      nodes.push(
        <h4 key={`h2-${idx}`} className="text-sm font-semibold text-zinc-900">
          {line.replace(/^##\s+/, "")}
        </h4>,
      );
      return;
    }

    if (line.startsWith("* ")) {
      list.push(
        <li key={`li-${idx}`} className="text-sm leading-relaxed text-zinc-800">
          {renderInline(line.replace(/^\*\s+/, ""))}
        </li>,
      );
      return;
    }

    flushList();
    nodes.push(
      <p key={`p-${idx}`} className="text-sm leading-relaxed text-zinc-800">
        {renderInline(line)}
      </p>,
    );
  });

  flushList();
  return nodes;
};

export default async function ConsentPrintPage({
  params,
}: {
  params: Promise<{ id?: string; consentId?: string }>;
}) {
  await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  const resolved = await params;
  const patientId = resolved?.id;
  const consentId = resolved?.consentId;

  if (!patientId || !consentId) {
    return notFound();
  }

  const consent = await prisma.patientConsent.findUnique({
    where: { id: consentId },
    include: {
      module: true,
      patient: { select: { firstName: true, lastName: true } },
    },
  });

  if (!consent || consent.patientId !== patientId) {
    return notFound();
  }

  const patientName = `${consent.patient.lastName} ${consent.patient.firstName}`.trim();
  const content = (consent.module?.content ?? "")
    .replace(/%PATIENT_NAME_HERE%/g, patientName || "Paziente")
    .replace(/%CODICE_FISCALE%/g, "—");

  const signatureUrl = consent.signatureUrl
    ? consent.signatureUrl.startsWith("data:image/")
      ? consent.signatureUrl
      : `data:image/png;base64,${consent.signatureUrl}`
    : null;

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
                Consenso
              </p>
              <h1 className="text-2xl font-semibold text-zinc-900">Studio Agovino & Angrisano</h1>
            </div>
          </div>
          <PrintButton
            className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600 print:hidden"
            label="Stampa consenso"
          />
        </div>
        <div className="grid gap-4 text-sm text-zinc-700 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Paziente</p>
            <p className="mt-2 text-base font-semibold text-zinc-900">{patientName}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Dettagli</p>
            <p className="mt-2 text-sm text-zinc-800">
              Modulo: {consent.module?.name ?? "Modulo consenso"}
            </p>
            <p className="text-sm text-zinc-800">
              Stampato il{" "}
              {new Date(consent.givenAt).toLocaleString("it-IT", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          </div>
        </div>

        <div className="space-y-4">{renderMarkdown(content)}</div>

        <div className="grid gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-zinc-600">
            <span className="rounded-full bg-white px-3 py-1">
              {consent.status}
            </span>
            <span>
              {new Date(consent.givenAt).toLocaleString("it-IT", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>
            <span>Canale: {consent.channel ?? "—"}</span>
            {consent.place ? <span>Luogo: {consent.place}</span> : null}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-zinc-500">Paziente</p>
              <p className="text-sm font-semibold text-zinc-900">{consent.patientName ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500">Medico</p>
              <p className="text-sm font-semibold text-zinc-900">{consent.doctorName ?? "—"}</p>
            </div>
          </div>
          {signatureUrl ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-3">
              <p className="text-xs font-semibold text-zinc-500">Firma</p>
              <img src={signatureUrl} alt="Firma digitale" className="mt-2 max-h-40 w-auto" />
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Firma non disponibile.</p>
          )}
        </div>
      </div>
    </div>
  );
}