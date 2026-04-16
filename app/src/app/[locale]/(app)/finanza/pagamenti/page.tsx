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
  inProgress: boolean,
  paghero: number
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
            payments: item.payments.map(p => ({
              ...p,
              amount: Number(p.amount.toString())
            }))
          })),
        }
      : null
  );
  const allPayments = (latestQuote?.items ?? [])
    .flatMap((item) =>
      item.payments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount.toString()),
        quoteItem: { 
          serviceName: item.serviceName,
          tooth: item.dentalRecord?.tooth
        },
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
        (payment.method !== "PAY_LATER" && payment.method !== "OTHER") ? sum + Number(payment.amount.toString()) : sum,
      0
    );
    const pagheroFromPayments = item.payments.reduce(
      (sum, payment) =>
        payment.method === "PAY_LATER" ? sum + Number(payment.amount.toString()) : sum,
      0
    );
    const altroFromPayments = item.payments.reduce(
      (sum, payment) =>
        payment.method === "OTHER" ? sum + Number(payment.amount.toString()) : sum,
      0
    );

    // Bug fix: Always prioritize paidFromPayments/pagheroFromPayments if there are any actual payments recorded.
    // Fall back to item.total only if item.saldato is true AND there are no actual payments.
    const hasActualPayments = item.payments.length > 0;
    const paid = (hasActualPayments)
      ? paidFromPayments 
      : item.saldato 
        ? total 
        : 0;
    
    const paghero = pagheroFromPayments;
    const altro = altroFromPayments;
        
    // Residuo = Total - Paid - Pagherò (Altro is excluded from subtraction)
    const remaining = Math.max(total - paid - paghero, 0);
    const inProgress = Boolean(item.dentalRecord && !item.dentalRecord.treated);
    const status = getQuoteItemPaymentStatus(paid + paghero, remaining, inProgress, altro);
    const tooth = item.dentalRecord?.tooth;
    return {
      id: item.id,
      serviceName: item.serviceName,
      tooth,
      quantity: item.quantity,
      total,
      paid,
      paghero,
      altro,
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
      acc.paghero += item.paghero;
      acc.remaining += item.remaining;
      return acc;
    },
    { total: 0, paid: 0, paghero: 0, remaining: 0 }
  );

  const altroTotal = allPayments
    .filter((p) => p.method === "OTHER")
    .reduce((sum, p) => sum + p.amount, 0);

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
