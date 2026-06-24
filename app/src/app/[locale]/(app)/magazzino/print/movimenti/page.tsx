import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { PrintButton } from "@/components/print-button";
import { buildStockMovementFilters } from "../../stock-movement-filters";
import { format } from "date-fns";
import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";

export const revalidate = 60;

export const metadata = createPageMetadata(PAGE_TITLES.listaMovimenti);

type MovimentiPrintPageProps = {
  searchParams?: Promise<{ mq?: string; from?: string; to?: string }>;
};

export default async function MovimentiPrintPage({ searchParams }: MovimentiPrintPageProps) {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const resolvedParams = searchParams ? await searchParams : undefined;
  const { dateFrom, dateTo, movementQuery, where } =
    buildStockMovementFilters(resolvedParams ?? {});

  const movements = await prisma.stockMovement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      product: true,
      patient: true,
    },
  });

  return (
    <div className="min-h-screen bg-zinc-100 px-6 py-8 dark:bg-zinc-900 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-5xl space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 print:max-w-none print:border-none print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800 print:pb-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-40 rounded-lg bg-white p-2 dark:bg-zinc-950">
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
                Lista movimenti
              </p>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Studio Agovino & Angrisano</h1>
              {movementQuery || dateFrom || dateTo ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Filtro:
                  {movementQuery ? ` ${movementQuery}` : null}
                  {dateFrom ? ` dal ${format(dateFrom, "dd/MM/yyyy")}` : null}
                  {dateTo ? ` al ${format(dateTo, "dd/MM/yyyy")}` : null}
                </p>
              ) : null}
            </div>
          </div>
          <PrintButton
            className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600 print:hidden"
            label="Stampa lista movimenti"
          />
        </div>

        <div className="relative overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white/90 to-transparent dark:from-zinc-950/90 sm:hidden" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white/90 to-transparent dark:from-zinc-950/90 sm:hidden" />
          <table className="min-w-full divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Paziente</th>
                <th className="px-4 py-3 text-left">Prodotto</th>
                <th className="px-4 py-3 text-left">UDI-PI (Lotto)</th>
                <th className="px-4 py-3 text-left">Qta</th>
                <th className="px-4 py-3 text-left">Sede</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {movements.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-zinc-600 dark:text-zinc-400" colSpan={6}>
                    Nessun movimento recente.
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {m.interventionDate
                        ? format(m.interventionDate, "dd/MM/yyyy")
                        : format(m.createdAt, "dd/MM/yyyy HH:mm")}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                      {m.patient ? `${m.patient.lastName} ${m.patient.firstName}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-zinc-900 dark:text-zinc-50">{m.product.name}</span>
                        <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                          {m.product.udiDi || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {m.udiPi ?? "—"}
                    </td>
                    <td className="px-4 py-3 dark:text-zinc-300">{m.quantity}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-xs">
                      {m.interventionSite ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
