import Link from "next/link";
import type { Metadata } from "next";
import { Role, type PatientPaymentMethod } from "@prisma/client";

export const metadata: Metadata = {
  title: "PAGAMENTI",
};
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializePatientQuoteDraft } from "@/lib/patients/page-data-domain";
import { QuoteAccordion } from "@/components/quote-accordion";
import { PaymentStateProvider } from "@/components/payment-state-provider";
import { PaymentsSummaryTiles } from "@/components/payments-summary-tiles";
import { UnsettledItemsList } from "@/components/unsettled-items-list";
import { PaymentRegistrationForm } from "@/components/payment-registration-form";
import { PaymentHistory } from "@/components/payment-history";
import { PatientSearchCombobox } from "@/components/patient-search-combobox";
import { Button } from "@/components/ui/button";
import { savePreventivoAction } from "@/lib/patients/actions";
import { archivePatientPayment, recordPatientPayment } from "../actions";
import { getUserDisplayTimeZone } from "@/lib/user-display-time-zone.server";
import {
  formatDateInputValueInTimeZone,
} from "@/lib/user-display-time-zone";
import { summarizeQuoteItem } from "@/lib/finance/domain-logic";

export const dynamic = "force-dynamic";

type SearchParams = {
  patientId?: string;
  q?: string;
};

const paymentMethodLabels: Record<PatientPaymentMethod, string> = {
  CASH: "Contanti",
  ELECTRONIC: "Elettronico",
  BANK_TRANSFER: "Bonifico",
  PAY_LATER: "Pagherò",
  OTHER: "insolvente",
};

export default async function PagamentiPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const displayTimeZone = await getUserDisplayTimeZone();

  const resolvedSearchParams = (await searchParams) ?? {};

  let selectedPatientId = resolvedSearchParams.patientId?.trim() ?? "";

  // If we have a search query (likely a quoteItemId from audit), try to resolve the patient
  if (!selectedPatientId && resolvedSearchParams.q) {
    const quoteItem = await prisma.quoteItem.findUnique({
      where: { id: resolvedSearchParams.q },
      select: { quote: { select: { patientId: true } } },
    });
    if (quoteItem?.quote.patientId) {
      selectedPatientId = quoteItem.quote.patientId;
    }
  }

  const patients = await prisma.patient.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });

  const selectedPatient = selectedPatientId
    ? await prisma.patient.findUnique({
        where: { id: selectedPatientId },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      })
    : null;
  const [services, latestQuote, doctors] =
    selectedPatientId && selectedPatient
      ? await Promise.all([
          prisma.service.findMany({
            orderBy: { createdAt: "desc" },
            select: { id: true, name: true, costBasis: true },
          }),
          prisma.quote.findFirst({
            where: { patientId: selectedPatientId },
            orderBy: { createdAt: "desc" },
            include: {
              payments: {
                where: { archivedAt: null },
                select: {
                  id: true,
                  amount: true,
                  paidAt: true,
                  method: true,
                  note: true,
                  quoteItemId: true,
                  user: {
                    select: { name: true, email: true },
                  },
                },
              },
              items: {
                orderBy: { createdAt: "asc" },
                include: {
                  dentalRecord: {
                    select: {
                      treated: true,
                      tooth: true,
                    },
                  },
                  payments: {
                    where: {
                      archivedAt: null,
                    },
                    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
                    select: {
                      id: true,
                      amount: true,
                      paidAt: true,
                      method: true,
                      note: true,
                      user: {
                        select: { name: true, email: true },
                      },
                    },
                  },
                },
              },
            },
          }),
          prisma.doctor.findMany({
            orderBy: { fullName: "asc" },
            select: { id: true, fullName: true },
          }),
        ])
      : [[], null, []];

  const parsedQuote = serializePatientQuoteDraft(
    latestQuote
      ? {
          ...latestQuote,
          items: latestQuote.items.map((item) => ({
            ...item,
            treated: item.dentalRecord?.treated ?? false,
            tooth: item.dentalRecord?.tooth ?? null,
            dentalRecordId: item.dentalRecordId,
            payments: item.payments.map((p) => ({
              ...p,
              amount: Number(p.amount.toString()),
            })),
          })),
        }
      : null
  );

  const quoteItemSummaries = (latestQuote?.items ?? []).map((item) => {
    const total = Number(item.total.toString());
    const paid = item.payments.reduce(
      (sum, p) => (p.method !== "PAY_LATER" && p.method !== "OTHER") ? sum + Number(p.amount.toString()) : sum,
      0
    );
    const paghero = item.payments.reduce(
      (sum, p) => p.method === "PAY_LATER" ? sum + Number(p.amount.toString()) : sum,
      0
    );
    const altro = item.payments.reduce(
      (sum, p) => p.method === "OTHER" ? sum + Number(p.amount.toString()) : sum,
      0
    );

    return summarizeQuoteItem({
      id: item.id,
      serviceName: item.serviceName,
      tooth: item.dentalRecord?.tooth,
      quantity: item.quantity,
      total,
      paid,
      paghero,
      altro,
      inProgress: Boolean(item.dentalRecord && !item.dentalRecord.treated),
    });
  });
  const altroTotal = latestQuote?.payments
    .filter(p => !p.quoteItemId)
    .reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;

  const patientOptions = patients.map((p) => ({
    id: p.id,
    fullName: `${p.lastName} ${p.firstName}`,
  }));

  const itemHistoricalPayments = latestQuote?.items.flatMap((item) =>
    item.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount.toString()),
      paidAt: p.paidAt,
      method: p.method,
      note: p.note,
      user: p.user,
      quoteItem: {
        serviceName: item.serviceName,
        tooth: item.dentalRecord?.tooth,
      },
    }))
  ) ?? [];

  const generalHistoricalPayments = latestQuote?.payments
    .filter(p => !p.quoteItemId)
    .map(p => ({
      id: p.id,
      amount: Number(p.amount.toString()),
      paidAt: p.paidAt,
      method: p.method,
      note: p.note,
      user: p.user,
      quoteItem: null,
    })) ?? [];

  const historicalPayments = [...itemHistoricalPayments, ...generalHistoricalPayments].sort(
    (a, b) => b.paidAt.getTime() - a.paidAt.getTime()
  );

  const defaultServiceDate = formatDateInputValueInTimeZone(new Date(), displayTimeZone);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 uppercase">Finanza</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Gestisci preventivi, incassi e contabilità pazienti
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
        <form className="lg:w-1/2 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 flex flex-col justify-center min-w-0">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">PAZIENTE</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <PatientSearchCombobox
                  key={selectedPatientId || "empty"}
                  name="patientId"
                  patients={patientOptions}
                  defaultValue={selectedPatientId}
                  placeholder="Cerca per cognome e nome"
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base font-semibold text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900"
                />
              </div>
              <Button type="submit" className="h-11 rounded-full px-5">
                Mostra contabilità
              </Button>
            </div>
          </div>
        </form>

        <div className="lg:w-1/2">
          {!selectedPatient ? (
            <div className="h-full rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 flex items-center justify-center">
              Nessun paziente selezionato.
            </div>
          ) : (
            <div className="h-full rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between h-full">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      PAZIENTE SELEZIONATO
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                      {selectedPatient.lastName} {selectedPatient.firstName}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {selectedPatient.email ?? "—"} · {selectedPatient.phone ?? "—"}
                    </p>
                  </div>
                </div>
                <Button asChild variant="primary" className="rounded-full shadow-sm"><Link
                    href={`/pazienti/${selectedPatient.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whitespace-nowrap"
                  >
                    Vai a scheda paziente
                  </Link></Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {!selectedPatient ? null : (
        <PaymentStateProvider initialItems={quoteItemSummaries} initialAltro={altroTotal}>
          <PaymentsSummaryTiles />

          <QuoteAccordion
            key={`${selectedPatient.id}:${parsedQuote?.id ?? "new"}:${parsedQuote?.signedAt ?? "unsigned"}`}
            patientId={selectedPatient.id}
            patientName={`${selectedPatient.lastName} ${selectedPatient.firstName}`.trim() || "Paziente"}
            defaultServiceDate={defaultServiceDate}
            services={services.map((service) => ({
              id: service.id,
              name: service.name,
              costBasis: Number(service.costBasis.toString()),
            }))}
            initialQuote={parsedQuote}
            printHref={parsedQuote?.id ? `/pazienti/${selectedPatient.id}/preventivo/${parsedQuote.id}` : null}
            className="bg-white dark:bg-zinc-950"
            onSave={savePreventivoAction}
          />

          <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
            <UnsettledItemsList />

            <PaymentRegistrationForm
              patientId={selectedPatient.id}
              quoteId={latestQuote?.id ?? ""}
              diarioUrl={`/pazienti/${selectedPatient.id}`}
              recordPatientPaymentAction={recordPatientPayment}
              doctors={doctors}
            />
          </div>

          <PaymentHistory
            historicalPayments={historicalPayments}
            paymentMethodLabels={paymentMethodLabels}
            displayTimeZone={displayTimeZone}
            archivePatientPaymentAction={archivePatientPayment}
          />
        </PaymentStateProvider>
      )}
    </div>
  );
}
