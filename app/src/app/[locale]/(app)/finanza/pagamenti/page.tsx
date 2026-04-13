import Link from "next/link";
import { Role, type PatientPaymentMethod } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializePatientQuoteDraft } from "@/lib/patients/page-data-domain";
import { QuoteAccordion } from "@/components/quote-accordion";
import { PatientPaymentFields } from "@/components/finance-forms";
import { PatientSearchCombobox } from "@/components/patient-search-combobox";
import { Button } from "@/components/ui/button";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ConfirmButton } from "@/components/confirm-button";
import { savePreventivoAction } from "@/lib/patients/actions";
import { archivePatientPayment, recordPatientPayment } from "../actions";

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

const formatDateInputValue = (value: Date, timeZone = "Europe/Rome") => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
};

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

  const parsedQuote = serializePatientQuoteDraft(latestQuote);
  const payments = (latestQuote?.items ?? [])
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

  const quoteItemSummaries = (latestQuote?.items ?? []).map((item) => {
    const total = Number(item.total.toString());
    const paidFromPayments = item.payments.reduce(
      (sum, payment) => sum + Number(payment.amount.toString()),
      0
    );
    const paid = paidFromPayments > 0 ? paidFromPayments : item.saldato ? total : 0;
    const remaining = Math.max(total - paid, 0);
    const inProgress = Boolean(item.dentalRecord && !item.dentalRecord.treated);
    const status = getQuoteItemPaymentStatus(paid, remaining, inProgress);
    return {
      id: item.id,
      serviceName: item.serviceName,
      quantity: item.quantity,
      total,
      paid,
      remaining,
      saldato: status === "settled",
      status,
      label: `${item.serviceName} · residuo ${formatCurrency(remaining)}`,
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
  const defaultServiceDate = formatDateInputValue(new Date());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Pagamenti pazienti</h1>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
        <form className="flex-1 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 flex flex-col justify-center min-w-0">
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
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900"
                />
              </div>
              <Button type="submit" className="h-11 rounded-full px-5">
                Mostra contabilità
              </Button>
            </div>
          </div>
        </form>

        <div className="lg:w-3/5">
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
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">CONTABILIZZAZIONE PRESTAZIONI</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{formatCurrency(totals.total)}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Incassato</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-500">{formatCurrency(totals.paid)}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Residuo</p>
              <p className="mt-2 text-2xl font-semibold text-amber-700 dark:text-amber-500">{formatCurrency(totals.remaining)}</p>
            </div>
          </div>

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
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">PAGAMENTI EFFETTUATI</h2>
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
                {!quoteItemSummaries.length ? (
                  <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                    Salva un preventivo per iniziare a registrare gli incassi.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {quoteItemSummaries.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{item.serviceName}</p>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400">Quantità: {item.quantity}</p>
                          </div>
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              item.status === "in_progress"
                                ? "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400"
                                : item.status === "settled"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : item.status === "partial"
                                  ? "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                            }`}
                          >
                            {item.status === "in_progress"
                              ? "Lavori in corso"
                              : item.status === "settled"
                              ? "Saldato"
                              : item.status === "partial"
                                ? "Parzialmente incassato"
                                : "Da incassare"}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-zinc-700 dark:text-zinc-300 sm:grid-cols-3">
                          <div>Totale: {formatCurrency(item.total)}</div>
                          <div>Incassato: {formatCurrency(item.paid)}</div>
                          <div>Residuo: {formatCurrency(item.remaining)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>

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
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      REGISTRA PAGAMENTO
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">NUOVO INCASSO</h2>
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
              <div className="p-6">
                {!latestQuote || !quoteItemSummaries.length ? (
                  <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                    Prima crea il preventivo del paziente.
                  </div>
                ) : quoteItemSummaries.every((item) => item.remaining < 0.01) ? (
                  <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                    Tutte le prestazioni del preventivo risultano saldate.
                  </div>
                ) : (
                  <form action={recordPatientPayment} className="space-y-3 text-sm">
                    <PatientPaymentFields
                      patientId={selectedPatient.id}
                      quoteId={latestQuote.id}
                      quoteItems={quoteItemSummaries.filter((item) => item.remaining > 0)}
                    />
                    <FormSubmitButton variant="primary" className="w-full rounded-full shadow-sm">
                      Registra pagamento
                    </FormSubmitButton>
                  </form>
                )}
              </div>
            </details>
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
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">STORICO PAGAMENTI</h2>
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
              {payments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                  Nessun pagamento registrato per questo paziente.
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map((payment) => (
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
                            {new Intl.DateTimeFormat("it-IT", {
                              dateStyle: "medium",
                            }).format(payment.paidAt)}
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
        </>
      )}
    </div>
  );
}
