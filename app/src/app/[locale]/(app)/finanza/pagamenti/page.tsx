import Link from "next/link";
import { Role, type PatientPaymentMethod } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializePatientQuoteDraft } from "@/lib/patients/page-data-domain";
import { getOptionalPrismaModel } from "@/lib/prisma-models";
import { QuoteAccordion } from "@/components/quote-accordion";
import { PatientPaymentFields } from "@/components/finance-forms";
import { PatientSearchCombobox } from "@/components/patient-search-combobox";
import { FormSubmitButton } from "@/components/form-submit-button";
import { savePreventivoAction } from "@/lib/patients/actions";
import { recordPatientPayment } from "../actions";

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

  const selectedPatientId = resolvedSearchParams.patientId ?? patients[0]?.id ?? "";
  const selectedPatient = selectedPatientId
    ? await prisma.patient.findUnique({
        where: { id: selectedPatientId },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      })
    : null;

  const patientPaymentClient = getOptionalPrismaModel<{
    findMany?: (args: {
      where: { patientId?: string; quoteItemId?: { in: string[] } };
      orderBy: Array<{ paidAt?: "desc" | "asc"; createdAt?: "desc" | "asc" }>;
      select: {
        id: true;
        quoteItemId: true;
        amount: true;
        paidAt: true;
        method: true;
        note: true;
        quoteItem: { select: { serviceName: true } };
        user: { select: { name: true; email: true } };
      };
      take: number;
    }) => Promise<
      Array<{
        id: string;
        quoteItemId: string | null;
        amount: { toString(): string };
        paidAt: Date;
        method: PatientPaymentMethod;
        note: string | null;
        quoteItem: { serviceName: string } | null;
        user: { name: string | null; email: string | null } | null;
      }>
    >;
  }>("patientPayment");

  const [services, latestQuote, payments] =
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
              },
            },
          }),
          patientPaymentClient?.findMany
            ? patientPaymentClient.findMany({
                where: { patientId: selectedPatientId },
                orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
                select: {
                  id: true,
                  quoteItemId: true,
                  amount: true,
                  paidAt: true,
                  method: true,
                  note: true,
                  quoteItem: {
                    select: { serviceName: true },
                  },
                  user: {
                    select: { name: true, email: true },
                  },
                },
                take: 50,
              })
            : Promise.resolve([]),
        ])
      : [[], null, []];

  const quoteItemPayments =
    latestQuote?.items?.length && patientPaymentClient?.findMany
      ? await patientPaymentClient.findMany({
          where: {
            quoteItemId: { in: latestQuote.items.map((item) => item.id) },
          },
          orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            quoteItemId: true,
            amount: true,
            paidAt: true,
            method: true,
            note: true,
            quoteItem: {
              select: { serviceName: true },
            },
            user: {
              select: { name: true, email: true },
            },
          },
          take: 500,
        })
      : [];

  const paymentsByQuoteItemId = new Map<string, number>();
  for (const payment of quoteItemPayments) {
    if (!payment.quoteItemId) continue;
    paymentsByQuoteItemId.set(
      payment.quoteItemId,
      (paymentsByQuoteItemId.get(payment.quoteItemId) ?? 0) + Number(payment.amount.toString())
    );
  }

  const parsedQuote = serializePatientQuoteDraft(latestQuote);
  const quoteItemSummaries = (latestQuote?.items ?? []).map((item) => {
    const total = Number(item.total.toString());
    const paidFromPayments = paymentsByQuoteItemId.get(item.id) ?? 0;
    const paid = paidFromPayments > 0 ? paidFromPayments : item.saldato ? total : 0;
    const remaining = Math.max(total - paid, 0);
    return {
      id: item.id,
      serviceName: item.serviceName,
      quantity: item.quantity,
      total,
      paid,
      remaining,
      saldato: remaining < 0.01,
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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-600">Finanza</p>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Pagamenti pazienti</h1>
      </div>

      <form className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Paziente
          <div className="flex flex-col gap-3 sm:flex-row">
            <PatientSearchCombobox
              key={selectedPatientId || "empty"}
              name="patientId"
              patients={patientOptions}
              defaultValue={selectedPatientId}
              placeholder="Cerca per cognome e nome"
              className="h-11 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
            />
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              Apri
            </button>
          </div>
        </label>
      </form>

      {!selectedPatient ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
          Nessun paziente disponibile.
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Paziente selezionato
                </p>
                <h2 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {selectedPatient.lastName} {selectedPatient.firstName}
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {selectedPatient.email ?? "—"} · {selectedPatient.phone ?? "—"}
                </p>
              </div>
              <Link
                href={`/pazienti/${selectedPatient.id}`}
                className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-emerald-700 dark:hover:text-emerald-300"
              >
                Apri scheda paziente
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preventivo</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{formatCurrency(totals.total)}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Incassato</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-700">{formatCurrency(totals.paid)}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Residuo</p>
              <p className="mt-2 text-2xl font-semibold text-amber-700">{formatCurrency(totals.remaining)}</p>
            </div>
          </div>

          <QuoteAccordion
            key={`${selectedPatient.id}:${parsedQuote?.id ?? "new"}:${parsedQuote?.signedAt ?? "unsigned"}`}
            patientId={selectedPatient.id}
            patientName={`${selectedPatient.lastName} ${selectedPatient.firstName}`.trim() || "Paziente"}
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
            <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Stato preventivo
                </p>
                <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Prestazioni e residui</h2>
              </div>

              {!quoteItemSummaries.length ? (
                <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                  Salva un preventivo per iniziare a registrare gli incassi.
                </div>
              ) : (
                <div className="space-y-3">
                  {quoteItemSummaries.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{item.serviceName}</p>
                          <p className="text-xs text-zinc-600 dark:text-zinc-400">Quantità: {item.quantity}</p>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            item.saldato
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.saldato ? "Saldato" : "Da incassare"}
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
            </section>

            <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Registra pagamento
                </p>
                <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Nuovo incasso</h2>
              </div>

              {!latestQuote || !quoteItemSummaries.length ? (
                <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                  Prima crea il preventivo del paziente.
                </div>
              ) : quoteItemSummaries.every((item) => item.remaining < 0.01) ? (
                <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                  Tutte le prestazioni del preventivo risultano saldate.
                </div>
              ) : (
                <form action={recordPatientPayment} className="space-y-3 text-sm">
                  <PatientPaymentFields
                    patientId={selectedPatient.id}
                    quoteId={latestQuote.id}
                    quoteItems={quoteItemSummaries.filter((item) => item.remaining > 0)}
                  />
                  <FormSubmitButton className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600">
                    Registra pagamento
                  </FormSubmitButton>
                </form>
              )}
            </section>
          </div>

          <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Storico
              </p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Pagamenti registrati</h2>
            </div>

            {payments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                Nessun pagamento registrato per questo paziente.
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900"
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
                        <span className="text-zinc-300">•</span>
                        <span>{paymentMethodLabels[payment.method]}</span>
                        <span className="text-zinc-300">•</span>
                        <span>{payment.user?.name ?? payment.user?.email ?? "Operatore"}</span>
                      </div>
                      {payment.note ? <p className="text-sm text-zinc-700 dark:text-zinc-300">{payment.note}</p> : null}
                    </div>
                    <span className="whitespace-nowrap rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
                      {formatCurrency(Number(payment.amount.toString()))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
