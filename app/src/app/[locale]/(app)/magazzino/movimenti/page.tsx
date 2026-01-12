import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role, StockMovementType } from "@prisma/client";
import { addStockMovement, deleteStockMovement, updateStockMovement } from "../actions";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

type MovimentiPageProps = {
  searchParams?: Promise<{ mq?: string; from?: string; to?: string }>;
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

export default async function MovimentiPage({ searchParams }: MovimentiPageProps) {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const resolvedParams = searchParams ? await searchParams : undefined;
  const movementQuery = typeof resolvedParams?.mq === "string" ? resolvedParams.mq.trim() : "";
  const fromParam = typeof resolvedParams?.from === "string" ? resolvedParams.from : "";
  const toParam = typeof resolvedParams?.to === "string" ? resolvedParams.to : "";
  const dateFrom = parseDateStart(fromParam);
  const dateTo = parseDateEnd(toParam);
  const movementWhere = movementQuery
    ? {
        OR: [
          { product: { name: { contains: movementQuery, mode: "insensitive" } } },
          { product: { udiDi: { contains: movementQuery, mode: "insensitive" } } },
          { udiPi: { contains: movementQuery, mode: "insensitive" } },
          { patient: { firstName: { contains: movementQuery, mode: "insensitive" } } },
          { patient: { lastName: { contains: movementQuery, mode: "insensitive" } } },
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
  const [products, movements] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.stockMovement.findMany({
      take: 50,
      where: movementFilters,
      orderBy: { createdAt: "desc" },
      include: { product: true, patient: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-600">Magazzino</p>
        <h1 className="text-2xl font-semibold text-zinc-900">Movimenti</h1>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">
          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-200 text-[13px] font-bold text-emerald-700">
            +
          </span>
          Movimenti
        </h2>
        <form action={addStockMovement} className="mt-3 space-y-3 text-sm">
          <select
            name="productId"
            className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Seleziona prodotto
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              name="quantity"
              type="number"
              min="1"
              required
              className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              placeholder="Quantità"
            />
            <select
              name="movement"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              required
              defaultValue="IN"
            >
              <option value="IN">Carico</option>
              <option value="OUT">Scarico</option>
            </select>
          </div>
          <input
            name="note"
            placeholder="Nota"
            className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            Registra movimento
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <form className="flex flex-wrap items-center gap-3" method="get">
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
          {movementQuery ? (
            <Link
              href="/magazzino/movimenti"
              className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              Annulla
            </Link>
          ) : null}
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {movements.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-600 shadow-sm sm:col-span-2">
            Nessun movimento presente.
          </div>
        ) : (
          movements.map((movement) => (
            <form
              key={movement.id}
              action={updateStockMovement}
              className="grid gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm shadow-sm sm:grid-cols-[2fr,1fr,1fr,2fr,auto] sm:items-end"
            >
              <input type="hidden" name="movementId" value={movement.id} />
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500">Prodotto</span>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2 text-sm text-zinc-800">
                  <div className="font-medium text-zinc-900">{movement.product.name}</div>
                  <div className="text-xs text-zinc-500">
                    {format(movement.createdAt, "dd/MM/yyyy HH:mm")}
                  </div>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500">Quantità</span>
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    required
                    defaultValue={movement.quantity}
                    className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500">Tipo</span>
                  <select
                    name="movement"
                    defaultValue={movement.movement}
                    className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    required
                  >
                    <option value="IN">Carico</option>
                    <option value="OUT">Scarico</option>
                  </select>
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500">Nota</span>
                <input
                  name="note"
                  defaultValue={movement.note ?? ""}
                  className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <div className="flex items-center gap-2 pb-1 sm:pb-0">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                >
                  Aggiorna
                </button>
                <button
                  type="submit"
                  formAction={deleteStockMovement}
                  data-confirm="Eliminare definitivamente questo movimento di magazzino?"
                  className="inline-flex items-center justify-center gap-1 rounded-full border border-rose-200 px-3 py-2 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50"
                >
                  Elimina
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7 2a2 2 0 00-2 2v1H3.5a.5.5 0 000 1h13a.5.5 0 000-1H15V4a2 2 0 00-2-2H7zm6 3V4a1 1 0 00-1-1H8a1 1 0 00-1 1v1h6zm-8 2a.5.5 0 01.5-.5h9a.5.5 0 01.5.5v8a2 2 0 01-2 2H7a2 2 0 01-2-2V7zm2.5.5a.5.5 0 00-1 0v7a.5.5 0 001 0v-7zm3 0a.5.5 0 10-1 0v7a.5.5 0 001 0v-7zm2.5 0a.5.5 0 00-1 0v7a.5.5 0 001 0v-7z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </form>
          ))
        )}
      </div>
    </div>
  );
}
