import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { DEFAULT_CLINIC_NAME } from "@/lib/brand";
import { ConfirmButton } from "@/components/confirm-button";
import { InvoiceEmailButton } from "@/components/invoice-email-button";
import { PrintButton } from "@/components/print-button";
import { Button } from "@/components/ui/button";
import { emailInvoiceAction, voidInvoiceAction } from "@/lib/finance/invoice-actions";
import { formatInvoiceNumber } from "@/lib/finance/invoices";
import { prisma } from "@/lib/prisma";
import { getPracticeTimeZone } from "@/lib/practice-settings";
import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import { formatDateInDisplayTimeZone } from "@/lib/user-display-time-zone";

export const metadata = createPageMetadata(PAGE_TITLES.fattura);

type SearchParams = {
  error?: string;
  sent?: string;
};

export default async function InvoiceDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ invoiceId?: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const invoiceId = (await params).invoiceId;
  if (!invoiceId) notFound();
  const query = (await searchParams) ?? {};
  const timeZone = await getPracticeTimeZone();
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lines: { orderBy: { createdAt: "asc" } },
      patient: { select: { firstName: true, lastName: true, email: true } },
    },
  });
  if (!invoice) notFound();

  const number = formatInvoiceNumber(invoice.year, invoice.number);
  const issued = invoice.status === "ISSUED";
  const email = invoice.patient.email?.trim() ?? "";
  const patientName = `${invoice.patient.lastName} ${invoice.patient.firstName}`.trim() || invoice.patientName;
  const total = Number(invoice.total.toString());

  return (
    <div className="min-h-screen bg-zinc-100 px-0 py-0 dark:bg-zinc-900 print:bg-white">
      <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 print:max-w-none print:border-none print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800 print:pb-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-40 rounded-lg bg-white p-2">
              <Image
                src="/logo/studio_agovinoangrisano_logo.png"
                alt={`Logo ${DEFAULT_CLINIC_NAME}`}
                width={320}
                height={120}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
                Fattura
              </p>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{DEFAULT_CLINIC_NAME}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <PrintButton label="Stampa fattura" variant="primary" />
            {issued ? (
              <ConfirmButton
                action={voidInvoiceAction}
                name="invoiceId"
                value={invoice.id}
                confirmTitle="Annulla fattura"
                confirmMessage="Annullare questa fattura? Le righe tornano disponibili per una nuova fattura."
                confirmText="Annulla fattura"
                variant="destructive-outline"
                size="sm"
              >
                Annulla fattura
              </ConfirmButton>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href="/finanza/fatture">Elenco</Link>
            </Button>
          </div>
        </div>

        {query.error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 print:hidden">{query.error}</p>
        ) : null}
        {query.sent ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 print:hidden">
            Fattura inviata a {email}, con il PDF in allegato.
          </p>
        ) : null}
        {!issued ? (
          <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">Annullata</p>
        ) : null}

        <div className="grid gap-4 text-sm text-zinc-700 dark:text-zinc-300 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Paziente</p>
            <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">{invoice.patientName}</p>
            {invoice.patientTaxId ? (
              <p className="text-xs text-zinc-600 dark:text-zinc-400">Codice fiscale {invoice.patientTaxId}</p>
            ) : null}
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Documento</p>
            <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">Numero {number}</p>
            <p className="text-sm text-zinc-800 dark:text-zinc-200">
              Data {formatDateInDisplayTimeZone(invoice.issuedAt, { dateStyle: "short" }, timeZone)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 text-left">Prestazione</th>
                <th className="px-4 py-3 text-right">Quantità</th>
                <th className="px-4 py-3 text-right">Prezzo (€)</th>
                <th className="px-4 py-3 text-right">Totale (€)</th>
                <th className="px-4 py-3 text-right">Data prestazione</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {invoice.lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">{line.serviceName}</td>
                  <td className="px-4 py-3 text-right">{line.quantity}</td>
                  <td className="px-4 py-3 text-right">{Number(line.price.toString()).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">{Number(line.total.toString()).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    {formatDateInDisplayTimeZone(line.serviceDate, { dateStyle: "short" }, timeZone)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <td className="px-4 py-3 text-right text-sm font-semibold" colSpan={3}>
                  Totale
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold">{total.toFixed(2)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Documento di studio. Non sostituisce la fattura elettronica.
        </p>

        {issued ? (
          <InvoiceEmailButton
            action={emailInvoiceAction}
            invoiceId={invoice.id}
            invoiceNumber={number}
            patientName={patientName}
            email={email}
          />
        ) : null}
      </div>
    </div>
  );
}
