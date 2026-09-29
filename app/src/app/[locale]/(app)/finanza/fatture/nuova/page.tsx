import Link from "next/link";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { PatientSearchCombobox } from "@/components/patient-search-combobox";
import { InvoiceDraftForm } from "@/components/invoice-draft-form";
import { Button } from "@/components/ui/button";
import { billableLines, invoiceSourceKey } from "@/lib/finance/invoices";
import { prisma } from "@/lib/prisma";
import { getPracticeTimeZone } from "@/lib/practice-settings";
import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import { formatDateInDisplayTimeZone } from "@/lib/user-display-time-zone";

export const metadata = createPageMetadata(PAGE_TITLES.nuovaFattura);

type SearchParams = {
  patientId?: string;
  error?: string;
};

function money(value: { toString(): string }) {
  return Number(value.toString());
}

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const params = (await searchParams) ?? {};
  const patientId = params.patientId?.trim() ?? "";
  const timeZone = await getPracticeTimeZone();
  const patients = await prisma.patient.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });
  const patientOptions = patients.map((patient) => ({
    id: patient.id,
    fullName: `${patient.lastName} ${patient.firstName}`.trim(),
  }));

  const patient = patientId
    ? await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } })
    : null;
  const quotes = patient
    ? await prisma.quote.findMany({
        where: { patientId },
        orderBy: [{ serviceDate: "asc" }, { createdAt: "asc" }],
        include: { items: { orderBy: { createdAt: "asc" } } },
      })
    : [];
  const invoiceLines = patient
    ? await prisma.invoiceLine.findMany({
        where: { invoice: { patientId } },
        select: { quoteId: true, quoteItemId: true, invoice: { select: { status: true } } },
      })
    : [];
  const available = billableLines(
    quotes.map((quote) => ({
      id: quote.id,
      serviceName: quote.serviceName,
      serviceDate: quote.serviceDate,
      quantity: quote.quantity,
      price: money(quote.price),
      total: money(quote.total),
      items: quote.items.map((item) => ({
        id: item.id,
        serviceName: item.serviceName,
        serviceDate: item.serviceDate,
        quantity: item.quantity,
        price: money(item.price),
        total: money(item.total),
      })),
    })),
    invoiceLines.map((line) => ({
      quoteId: line.quoteId,
      quoteItemId: line.quoteItemId,
      status: line.invoice.status,
    })),
  );
  const groups = quotes
    .map((quote) => ({
      quoteId: quote.id,
      title: `Preventivo ${formatDateInDisplayTimeZone(quote.serviceDate, { dateStyle: "short" }, timeZone)} · ${quote.serviceName}`,
      lines: available
        .filter((line) => line.quoteId === quote.id)
        .map((line) => ({
          key: invoiceSourceKey(line.quoteId, line.quoteItemId),
          serviceName: line.serviceName,
          serviceDate: formatDateInDisplayTimeZone(line.serviceDate, { dateStyle: "short" }, timeZone),
          quantity: line.quantity,
          totalLabel: line.total.toFixed(2),
          total: line.total,
        })),
    }))
    .filter((group) => group.lines.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Nuova fattura</h1>
        <Button asChild variant="outline">
          <Link href="/finanza/fatture">Elenco</Link>
        </Button>
      </div>

      {params.error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{params.error}</p>
      ) : null}

      <form className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Paziente</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <PatientSearchCombobox
              key={patientId || "empty"}
              name="patientId"
              patients={patientOptions}
              defaultValue={patientId}
              placeholder="Cerca per cognome e nome"
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base font-semibold text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>
          <Button type="submit">Mostra righe</Button>
        </div>
      </form>

      {!patientId ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Scegli un paziente per vedere le righe fatturabili.</p>
      ) : !patient ? (
        <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
          Paziente non trovato.
        </p>
      ) : quotes.length === 0 ? (
        <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
          Questo paziente non ha preventivi.
        </p>
      ) : groups.length === 0 ? (
        <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
          Tutte le righe dei preventivi sono già in una fattura emessa.
        </p>
      ) : (
        <InvoiceDraftForm patientId={patientId} groups={groups} />
      )}
    </div>
  );
}
