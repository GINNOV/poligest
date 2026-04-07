import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";

const ARCHIVE_PREFIX = "ARCHIVIATO:";

export default async function FinanzaPage() {
  await requireUser([Role.ADMIN, Role.MANAGER]);

  const entries = await prisma.financeEntry.findMany({
    where: {
      NOT: {
        description: { startsWith: ARCHIVE_PREFIX },
      },
    },
    select: { type: true, amount: true },
    take: 200,
  });

  const totals = entries.reduce(
    (acc, e) => {
      if (e.type.toUpperCase() === "INCOME") {
        acc.income += Number(e.amount);
      } else {
        acc.expense += Number(e.amount);
      }
      return acc;
    },
    { income: 0, expense: 0 }
  );


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Movimenti</h1>
        <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 shadow-sm font-mono uppercase tracking-wide">
          Saldo: {(totals.income - totals.expense).toFixed(2)} €
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/finanza/pagamenti"
          className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="overflow-hidden rounded-2xl border border-zinc-100">
            <Image
              src="/tiles/payer.png"
              alt="Pagamenti pazienti"
              width={640}
              height={360}
              className="h-44 w-full object-cover"
            />
          </div>
          <h2 className="mt-3 text-base font-semibold text-zinc-900">Pagamenti Pazienti</h2>
        </Link>
        <Link
          href="/finanza/spese"
          className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="overflow-hidden rounded-2xl border border-zinc-100">
            <Image
              src="/tiles/spending.png"
              alt="Nuova spesa"
              width={640}
              height={360}
              className="h-44 w-full object-cover"
            />
          </div>
          <h2 className="mt-3 text-base font-semibold text-zinc-900">Nuova spesa</h2>
        </Link>
        <Link
          href="/finanza/anticipi"
          className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="overflow-hidden rounded-2xl border border-zinc-100">
            <Image
              src="/tiles/advance.png"
              alt="Pagamenti medici"
              width={640}
              height={360}
              className="h-44 w-full object-cover"
            />
          </div>
          <h2 className="mt-3 text-base font-semibold text-zinc-900">Pagamenti medici</h2>
        </Link>
      </div>
    </div>
  );
}
