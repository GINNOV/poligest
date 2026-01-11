import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { createProduct, deleteProduct, updateProduct } from "../actions";

export const dynamic = "force-dynamic";

export default async function ProdottiPage() {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const [productsRaw, suppliers] = await Promise.all([
    prisma.product.findMany({
      include: { stockMovements: { select: { quantity: true, movement: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
  ]);

  const products = productsRaw.map((p) => {
    const stock = p.stockMovements.reduce((acc, m) => {
      return acc + (m.movement === "IN" ? m.quantity : -m.quantity);
    }, 0);
    return { ...p, stock };
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-600">Magazzino</p>
        <h1 className="text-2xl font-semibold text-zinc-900">Prodotti</h1>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">
          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-200 text-[13px] font-bold text-emerald-700">
            +
          </span>
          Gestione prodotti
        </h2>
        <form action={createProduct} className="mt-3 space-y-3 text-sm">
          <input
            name="name"
            placeholder="Nome prodotto"
            required
            className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
          <input
            name="sku"
            placeholder="SKU"
            className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
          <input
            name="udiDi"
            placeholder="UDI-DI"
            className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
          <input
            name="serviceType"
            placeholder="Tipo servizio (es. Igiene)"
            className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
          <input
            name="unitCost"
            placeholder="Costo unitario (€)"
            className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            type="number"
            step="0.01"
            min="0"
          />
          <input
            name="minThreshold"
            placeholder="Soglia minima"
            className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            type="number"
            min="0"
            defaultValue={0}
          />
          <select
            name="supplierId"
            className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">Senza fornitore</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            Aggiungi prodotto
          </button>
        </form>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">Prodotti</h2>
        {products.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-600 shadow-sm">
            Nessun prodotto presente.
          </div>
        ) : (
          products.map((product) => (
            <form
              key={product.id}
              action={updateProduct}
              className="grid gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm shadow-sm sm:grid-cols-[2fr,1.5fr,1.5fr,1fr,1fr,auto] sm:items-end"
            >
              <input type="hidden" name="productId" value={product.id} />
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500">Nome</span>
                <input
                  name="name"
                  defaultValue={product.name}
                  className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500">SKU</span>
                <input
                  name="sku"
                  defaultValue={product.sku ?? ""}
                  className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500">UDI-DI</span>
                <input
                  name="udiDi"
                  defaultValue={product.udiDi ?? ""}
                  className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500">Soglia</span>
                <input
                  type="number"
                  name="minThreshold"
                  defaultValue={product.minThreshold ?? 0}
                  className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500">Fornitore</span>
                <select
                  name="supplierId"
                  defaultValue={product.supplierId ?? ""}
                  className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">—</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
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
                  formAction={deleteProduct}
                  data-confirm="Eliminare definitivamente questo prodotto e i movimenti collegati?"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50"
                >
                  <span className="sr-only">Elimina</span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
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
