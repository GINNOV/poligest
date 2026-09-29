import Link from "next/link";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { formatInvoiceNumber } from "@/lib/finance/invoices";
import { prisma } from "@/lib/prisma";
import { getPracticeTimeZone } from "@/lib/practice-settings";
import { Button } from "@/components/ui/button";
import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import { formatDateInDisplayTimeZone } from "@/lib/user-display-time-zone";

export const metadata = createPageMetadata(PAGE_TITLES.fatture);

const statusLabel = {
  ISSUED: "Emessa",
  VOID: "Annullata",
} as const;

export default async function InvoicesPage() {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const timeZone = await getPracticeTimeZone();
  const invoices = await prisma.invoice.findMany({
    orderBy: [{ issuedAt: "desc" }, { number: "desc" }],
    select: {
      id: true,
      year: true,
      number: true,
      issuedAt: true,
      status: true,
      patientName: true,
      total: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Fatture</h1>
          <p className="text-sm text-zinc-500">Documenti di studio emessi dai preventivi.</p>
        </div>
        <Button asChild>
          <Link href="/finanza/fatture/nuova">Nuova fattura</Link>
        </Button>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Non ci sono fatture</p>
          <Button asChild className="mt-4">
            <Link href="/finanza/fatture/nuova">Nuova fattura</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="min-w-full divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 text-left">Numero</th>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Paziente</th>
                <th className="px-4 py-3 text-right">Totale</th>
                <th className="px-4 py-3 text-left">Stato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/finanza/fatture/${invoice.id}`} className="text-emerald-800 hover:underline dark:text-emerald-300">
                      {formatInvoiceNumber(invoice.year, invoice.number)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {formatDateInDisplayTimeZone(invoice.issuedAt, { dateStyle: "short" }, timeZone)}
                  </td>
                  <td className="px-4 py-3">{invoice.patientName}</td>
                  <td className="px-4 py-3 text-right">{Number(invoice.total.toString()).toFixed(2)}</td>
                  <td className="px-4 py-3">{statusLabel[invoice.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
