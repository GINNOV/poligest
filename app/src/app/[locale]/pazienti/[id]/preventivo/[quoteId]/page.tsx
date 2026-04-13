import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { Role } from "@prisma/client";
import { PrintButton } from "@/components/print-button";
import type { Metadata } from "next";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { getUserDisplayTimeZone } from "@/lib/user-display-time-zone.server";
import { formatDateInDisplayTimeZone } from "@/lib/user-display-time-zone";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preventivo",
};

export default async function QuotePrintPage({
  params,
}: {
  params: Promise<{ id?: string; quoteId?: string }>;
}) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  await requireFeatureAccess(user.role, "quotes");
  await requireFeatureAccess(Role.ADMIN, "quotes");
  const displayTimeZone = await getUserDisplayTimeZone();
  const resolvedParams = await params;
  const patientId = resolvedParams?.id;
  const quoteId = resolvedParams?.quoteId;
  if (!patientId || !quoteId) {
    return notFound();
  }

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, patientId },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          payments: true,
        },
      },
    },
  });
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { firstName: true, lastName: true, email: true, phone: true },
  });

  if (!quote || !patient) {
    return notFound();
  }

  const price = Number(quote.price.toString());
  const total = Number(quote.total.toString());
  const signedAt = new Date(quote.signedAt);
  const rawItems = quote.items ?? [];
  const items = rawItems.length
    ? rawItems.map((item) => ({
        id: item.id,
        serviceName: item.serviceName,
        serviceDate: new Date(item.serviceDate),
        quantity: item.quantity,
        price: Number(item.price.toString()),
        total: Number(item.total.toString()),
        paid:
          item.payments.length > 0
            ? item.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
            : item.saldato
              ? Number(item.total.toString())
              : 0,
        createdAt: item.createdAt ? new Date(item.createdAt) : null,
      }))
    : [
        {
          id: quote.id,
          serviceName: quote.serviceName,
          serviceDate: new Date(quote.serviceDate),
          quantity: quote.quantity,
          price,
          total,
          paid: 0,
          createdAt: null,
        },
      ];
  const itemsTotal = items.reduce((sum, item) => sum + Math.max(item.total - item.paid, 0), 0);

  return (
    <div className="min-h-screen bg-zinc-100 px-6 py-8 dark:bg-zinc-900 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 print:max-w-none print:border-none print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800 print:pb-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-40 rounded-lg bg-white p-2 dark:bg-white/90">
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
                Preventivo
              </p>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Studio Agovino & Angrisano</h1>
            </div>
          </div>
          <PrintButton
            label="Stampa preventivo"
            variant="primary"
            className="print:hidden"
          />
        </div>

        <div className="grid gap-4 text-sm text-zinc-700 dark:text-zinc-300 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Paziente</p>
            <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {patient.lastName} {patient.firstName}
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">{patient.email ?? "—"}</p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">{patient.phone ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Dettagli</p>
            <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">
              Data accettazione:{" "}
              {formatDateInDisplayTimeZone(
                signedAt,
                { dateStyle: "short", timeStyle: "short" },
                displayTimeZone
              )}
            </p>
            <p className="text-sm text-zinc-800 dark:text-zinc-200">Preventivo ID: {quote.id}</p>
          </div>
        </div>

        <div className="relative overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white/90 to-transparent sm:hidden dark:from-zinc-950/90" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white/90 to-transparent sm:hidden dark:from-zinc-950/90" />
          <table className="min-w-full divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 text-left">Prestazione</th>
                <th className="px-4 py-3 text-right">Quantità</th>
                <th className="px-4 py-3 text-right">Prezzo (€)</th>
                <th className="px-4 py-3 text-right">Totale (€)</th>
                <th className="px-4 py-3 text-right">Data prestazione</th>
                <th className="px-4 py-3 text-right">Incassato (€)</th>
                <th className="px-4 py-3 text-right">Residuo (€)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">{item.serviceName}</td>
                  <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">{item.price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">{item.total.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-400">
                    {formatDateInDisplayTimeZone(item.serviceDate, { dateStyle: "short" }, displayTimeZone)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">{item.paid.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                    {Math.max(item.total - item.paid, 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-700 dark:text-zinc-300" colSpan={6}>
                  Totale da saldare
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {itemsTotal.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="grid gap-6 border-t border-zinc-200 pt-6 dark:border-zinc-800 sm:grid-cols-[1fr,240px]">
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            Il presente preventivo è valido salvo variazioni concordate con lo studio. Eventuali
            modifiche saranno confermate con un nuovo documento firmato.
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Firma cliente</p>
            <Image
              src={quote.signatureUrl}
              alt="Firma cliente"
              width={320}
              height={96}
              unoptimized
              className="mt-2 h-24 w-full object-contain dark:bg-white/90 dark:rounded-lg"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
          <span>
            Data stampa: {formatDateInDisplayTimeZone(new Date(), { dateStyle: "short" }, displayTimeZone)}
          </span>
          <span>siamo online su sorrisosplendente.com</span>
        </div>
      </div>
    </div>
  );
}
