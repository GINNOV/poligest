import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Prisma, Role } from "@prisma/client";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

type MagazzinoPageProps = {
  searchParams?: Promise<{ q?: string; mq?: string; from?: string; to?: string }>;
};

const parseDateStart = (value: string) => {
  if (!value) {
    return null;
  }
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseDateEnd = (value: string) => {
  if (!value) {
    return null;
  }
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export default async function MagazzinoPage({ searchParams }: MagazzinoPageProps) {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const resolvedParams = searchParams ? await searchParams : undefined;
  const query = typeof resolvedParams?.q === "string" ? resolvedParams.q.trim() : "";
  const movementQuery = typeof resolvedParams?.mq === "string" ? resolvedParams.mq.trim() : "";
  const fromParam = typeof resolvedParams?.from === "string" ? resolvedParams.from : "";
  const toParam = typeof resolvedParams?.to === "string" ? resolvedParams.to : "";
  const dateFrom = parseDateStart(fromParam);
  const dateTo = parseDateEnd(toParam);
  const movementWhere: Prisma.StockMovementWhereInput | undefined = movementQuery
    ? {
        OR: [
          {
            product: {
              is: { name: { contains: movementQuery, mode: Prisma.QueryMode.insensitive } },
            },
          },
          {
            product: {
              is: { udiDi: { contains: movementQuery, mode: Prisma.QueryMode.insensitive } },
            },
          },
          { udiPi: { contains: movementQuery, mode: Prisma.QueryMode.insensitive } },
          {
            patient: {
              is: { firstName: { contains: movementQuery, mode: Prisma.QueryMode.insensitive } },
            },
          },
          {
            patient: {
              is: { lastName: { contains: movementQuery, mode: Prisma.QueryMode.insensitive } },
            },
          },
        ],
      }
    : undefined;
  const dateWhere =
    dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          },
        }
      : undefined;
  const movementFilters =
    movementWhere && dateWhere
      ? { AND: [movementWhere, dateWhere] }
      : movementWhere ?? dateWhere;
  const productPrintHref = query
    ? `/magazzino/print/prodotti?q=${encodeURIComponent(query)}`
    : "/magazzino/print/prodotti";
  const movementPrintParams = new URLSearchParams();
  if (movementQuery) {
    movementPrintParams.set("mq", movementQuery);
  }
  if (fromParam) {
    movementPrintParams.set("from", fromParam);
  }
  if (toParam) {
    movementPrintParams.set("to", toParam);
  }
  const movementPrintHref = movementPrintParams.toString()
    ? `/magazzino/print/movimenti?${movementPrintParams.toString()}`
    : "/magazzino/print/movimenti";
  const [productsRaw, suppliers, movements] = await Promise.all([
    prisma.product.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { udiDi: { contains: query, mode: "insensitive" } },
              { udiPi: { contains: query, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: {
        supplier: true,
        stockMovements: { select: { quantity: true, movement: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.stockMovement.findMany({
      take: 50,
      where: movementFilters,
      orderBy: { createdAt: "desc" },
      include: {
        product: true,
        patient: true,
      },
    }),
  ]);
  const hasMovementFilters = Boolean(movementQuery || fromParam || toParam);

  const products = productsRaw.map((p) => {
    const stock = p.stockMovements.reduce((acc, m) => {
      return acc + (m.movement === "IN" ? m.quantity : -m.quantity);
    }, 0);
    return { ...p, stock };
  });

  return (
    <div className="space-y-8">
      {/* Products Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Movimenti &amp; Prodotti</h1>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href="/magazzino/fornitori"
            className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="overflow-hidden rounded-2xl border border-zinc-100">
              <Image
                src="/tiles/suppliers.png"
                alt="Gestione fornitori"
                width={640}
                height={360}
                className="h-44 w-full object-cover"
              />
            </div>
            <h2 className="mt-3 text-base font-semibold text-zinc-900">Gestione fornitori</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Aggiungi nuovi fornitori. Aggiorna fornitori esistenti.
            </p>
          </Link>
          <Link
            href="/magazzino/prodotti"
            className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="overflow-hidden rounded-2xl border border-zinc-100">
              <Image
                src="/tiles/products.png"
                alt="Gestione prodotti"
                width={640}
                height={360}
                className="h-44 w-full object-cover"
              />
            </div>
            <h2 className="mt-3 text-base font-semibold text-zinc-900">Gestione prodotti</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Aggiungi un prodotto da utilizzare nei movimenti
            </p>
          </Link>
          <Link
            href="/magazzino/movimenti"
            className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="overflow-hidden rounded-2xl border border-zinc-100">
              <Image
                src="/tiles/accounting.png"
                alt="Movimenti"
                width={640}
                height={360}
                className="h-44 w-full object-cover"
              />
            </div>
            <h2 className="mt-3 text-base font-semibold text-zinc-900">Movimenti</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Entrate e uscite per il magazzino
            </p>
          </Link>
        </div>

        <details className="rounded-2xl border border-zinc-200 bg-white shadow-sm" open={Boolean(movementQuery)}>
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-zinc-900">
            Lista prodotti
          </summary>
          <div className="border-t border-zinc-100 px-4 pb-4 pt-3 space-y-3">
            <form className="flex flex-wrap items-center gap-3" method="get">
              {movementQuery ? (
                <input type="hidden" name="mq" value={movementQuery} />
              ) : null}
              <div className="flex-1 min-w-[220px]">
                <input
                  type="search"
                  name="q"
                  placeholder="Cerca per nome o UDI"
                  defaultValue={query}
                  className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                Cerca
              </button>
              {query ? (
                <Link
                  href={movementQuery ? `/magazzino?mq=${encodeURIComponent(movementQuery)}` : "/magazzino"}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50"
                >
                  Annulla
                </Link>
              ) : null}
              <a
                href={productPrintHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                Stampa lista
              </a>
            </form>

            <div className="relative overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white/90 to-transparent sm:hidden" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white/90 to-transparent sm:hidden" />
              <table className="min-w-full divide-y divide-zinc-100">
                <thead className="bg-zinc-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <th className="px-4 py-3">Prodotto</th>
                    <th className="px-4 py-3">UDI-DI / UDI-PI</th>
                    <th className="px-4 py-3">Fornitore</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Soglia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-sm">
                  {products.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-zinc-600" colSpan={5}>
                        Nessun prodotto a catalogo.
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => {
                      const low = p.stock <= p.minThreshold;
                      return (
                        <tr key={p.id} className="hover:bg-zinc-50">
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-semibold text-zinc-900">{p.name}</span>
                              <span className="text-xs text-zinc-500">
                                {p.serviceType ?? "Generico"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-zinc-600 font-mono text-xs">
                            <div className="flex flex-col gap-0.5">
                              <span>UDI-DI {p.udiDi ?? "—"}</span>
                              <span className="text-[11px] text-zinc-400">UDI-PI {p.udiPi ?? "—"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            {p.supplier?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                low
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-50 text-emerald-800"
                              }`}
                            >
                              {p.stock}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-700">{p.minThreshold}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </div>

      {/* Movements Section */}
      <div className="space-y-4">
        <details className="rounded-2xl border border-zinc-200 bg-white shadow-sm" open={Boolean(query)}>
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-zinc-900">
            Lista movimenti
          </summary>
          <div className="border-t border-zinc-100 px-4 pb-4 pt-3 space-y-3">
            <form className="flex flex-wrap items-center gap-3" method="get">
              {query ? <input type="hidden" name="q" value={query} /> : null}
              <div className="flex-1 min-w-[220px]">
                <input
                  type="search"
                  name="mq"
                  placeholder="Cerca movimenti"
                  defaultValue={movementQuery}
                  className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <input
                type="date"
                name="from"
                aria-label="Data da"
                defaultValue={fromParam}
                className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
              <input
                type="date"
                name="to"
                aria-label="Data a"
                defaultValue={toParam}
                className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                Cerca
              </button>
              {hasMovementFilters ? (
                <Link
                  href={query ? `/magazzino?q=${encodeURIComponent(query)}` : "/magazzino"}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50"
                >
                  Annulla
                </Link>
              ) : null}
              <a
                href={movementPrintHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                Stampa lista
              </a>
            </form>

            <div className="relative overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white/90 to-transparent sm:hidden" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white/90 to-transparent sm:hidden" />
              <table className="min-w-full divide-y divide-zinc-100">
                <thead className="bg-zinc-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Paziente</th>
                    <th className="px-4 py-3">Prodotto</th>
                    <th className="px-4 py-3">UDI-PI (Lotto)</th>
                    <th className="px-4 py-3">Qta</th>
                    <th className="px-4 py-3">Sede</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-sm">
                  {movements.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-zinc-600" colSpan={6}>
                        Nessun movimento recente.
                      </td>
                    </tr>
                  ) : (
                    movements.map((m) => (
                      <tr key={m.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 text-zinc-600">
                          {m.interventionDate
                            ? format(m.interventionDate, "dd/MM/yyyy")
                            : format(m.createdAt, "dd/MM/yyyy HH:mm")}
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-900">
                          {m.patient ? `${m.patient.lastName} ${m.patient.firstName}` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-zinc-900">{m.product.name}</span>
                            <span className="text-xs text-zinc-500 font-mono">
                              {m.product.udiDi || "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-600 font-mono text-xs">
                          {m.udiPi ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                              m.movement === "IN"
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                                : "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10"
                            }`}
                          >
                            {m.movement === "IN" ? "+" : "-"}
                            {m.quantity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-600 text-xs">
                          {m.interventionSite ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </div>

    </div>
  );
}
