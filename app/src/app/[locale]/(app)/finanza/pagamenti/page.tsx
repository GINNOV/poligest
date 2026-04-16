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
import { PatientPaymentFields } from "@/components/finance-forms";
import { PatientSearchCombobox } from "@/components/patient-search-combobox";
import { Button } from "@/components/ui/button";
import { FormSubmitButton } from "@/components/form-submit-button";
import { savePreventivoAction } from "@/lib/patients/actions";
import { archivePatientPayment, recordPatientPayment } from "../actions";
import { getUserDisplayTimeZone } from "@/lib/user-display-time-zone.server";
import {
  formatDateInDisplayTimeZone,
  formatDateInputValueInTimeZone,
} from "@/lib/user-display-time-zone";

export const dynamic = "force-dynamic";

type SearchParams = {
  patientId?: string;
};

const paymentMethodLabels: Record<PatientPaymentMethod, string> = {
  CASH: "Contanti",
  ELECTRONIC: "Elettronico",
  BANK_TRANSFER: "Bonifico",
  PAY_LATER: "Pagherò",
  OTHER: "Altro",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);

type QuoteItemPaymentStatus = "settled" | "partial" | "unpaid" | "in_progress";

function getQuoteItemPaymentStatus(
  paid: number,
  remaining: number,
  inProgress: boolean
): QuoteItemPaymentStatus {
  if (inProgress) return "in_progress";
  if (remaining < 0.01) return "settled";
  if (paid > 0.009) return "partial";
  return "unpaid";
}

export default async function PagamentiPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const displayTimeZone = await getUserDisplayTimeZone();

  const resolvedSearchParams = (await searchParams) ?? {};
  const patients = await prisma.patient.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });

  const selectedPatientId = resolvedSearchParams.patientId?.trim() ?? "";
  const selectedPatient = selectedPatientId
    ? await prisma.patient.findUnique({
        where: { id: selectedPatientId },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      })
    : null;
  const [services, latestQuote] =
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
        ])
      : [[], null];

  const parsedQuote = serializePatientQuoteDraft(
    latestQuote
      ? {
          ...latestQuote,
          items: latestQuote.items.map((item) => ({
            ...item,
            treated: item.dentalRecord?.treated,
            tooth: item.dentalRecord?.tooth,
          })),
        }
      : null
  );
  const allPayments = (latestQuote?.items ?? [])
    .flatMap((item) =>
      item.payments.map((payment) => ({
        ...payment,
        quoteItem: { serviceName: item.serviceName },
      }))
    )
    .sort((a, b) => {
      const paidAtDiff = b.paidAt.getTime() - a.paidAt.getTime();
      if (paidAtDiff !== 0) return paidAtDiff;
      return b.id.localeCompare(a.id, "it");
    });

  // effective payments exclude PAY_LATER
  const payments = allPayments.filter((p) => p.method !== "PAY_LATER");
  const historicalPayments = allPayments;

  const quoteItemSummaries = (latestQuote?.items ?? []).map((item) => {
    const total = Number(item.total.toString());
    const paidFromPayments = item.payments.reduce(
      (sum, payment) =>
        payment.method !== "PAY_LATER" ? sum + Number(payment.amount.toString()) : sum,
      0
    );
    // Bug fix: Always prioritize paidFromPayments if there are any actual payments recorded.
    // Fall back to item.total only if item.saldato is true AND there are no actual payments.
    const hasActualPayments = item.payments.some(p => p.method !== 'PAY_LATER');
    const paid = (paidFromPayments > 0 || hasActualPayments)
      ? paidFromPayments 
      : item.saldato 
        ? total 
        : 0;
    const remaining = Math.max(total - paid, 0);
    const inProgress = Boolean(item.dentalRecord && !item.dentalRecord.treated);
    const status = getQuoteItemPaymentStatus(paid, remaining, inProgress);
    const tooth = item.dentalRecord?.tooth;
    return {
      id: item.id,
      serviceName: item.serviceName,
      tooth,
      quantity: item.quantity,
      total,
      paid,
      remaining,
      saldato: status === "settled",
      status,
      label: `${item.serviceName}${tooth ? ` (Dente ${tooth})` : ""} · residuo ${formatCurrency(remaining)}`,
    };
  });

  const totals = quoteItemSummaries.reduce(
    (acc, item) => {
      acc.total += item.total;
      acc.paid += item.paid;
      acc.remaining += item.remaining;
      return acc;
    },
    { total: 0, paid: 0, remaining: 0 }
  );
  const patientOptions = patients.map((patient) => ({
    id: patient.id,
    fullName: `${patient.lastName} ${patient.firstName}`,
  }));
  const defaultServiceDate = formatDateInputValueInTimeZone(new Date(), displayTimeZone);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Pagamenti pazienti</h1>
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
        <PaymentStateProvider initialItems={quoteItemSummaries}>
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
            />
          </div>

          <details className="group rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <svg
                  className="h-8 w-8 text-emerald-600 dark:text-emerald-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">4 - STORICO PAGAMENTI</h2>
                </div>
              </div>
              <svg
                className="h-5 w-5 text-zinc-600 dark:text-zinc-400 transition-transform duration-200 group-open:rotate-180"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <div className="space-y-4 p-6">
              {historicalPayments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                  Nessun pagamento registrato per questo paziente.
                </div>
              ) : (
                <div className="space-y-3">
                  {historicalPayments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900/50"
                      >
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {payment.quoteItem?.serviceName ?? "Pagamento paziente"}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                          <span>
                            {formatDateInDisplayTimeZone(
                              payment.paidAt,
                              {
                                dateStyle: "medium",
                              },
                              displayTimeZone
                            )}
                          </span>
                          <span className="text-zinc-300 dark:text-zinc-700">•</span>
                          <span>{paymentMethodLabels[payment.method]}</span>
                          <span className="text-zinc-300 dark:text-zinc-700">•</span>
                          <span>{payment.user?.name ?? payment.user?.email ?? "Operatore"}</span>
                        </div>
                        {payment.note ? <p className="text-sm text-zinc-700 dark:text-zinc-300">{payment.note}</p> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <form action={archivePatientPayment}>
                          <input type="hidden" name="paymentId" value={payment.id} />
                          <Button
                            variant="outline"
                            size="xs"
                            type="submit"
                            className="rounded-full"
                            data-confirm="Archiviare questo pagamento registrato?"
                          >
                            Archivia
                          </Button>
                        </form>
                        <span className="whitespace-nowrap rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                          {formatCurrency(Number(payment.amount.toString()))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        </PaymentStateProvider>
      )}
    </div>
  );
}
