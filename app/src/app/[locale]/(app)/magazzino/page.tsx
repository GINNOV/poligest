import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import {
  createSupplier,
  createProduct,
  addStockMovement,
  deleteSupplier,
  updateProduct,
  updateSupplier,
} from "./actions";
import { format } from "date-fns";
import { ProductDeleteButton } from "@/components/product-delete-button";

export const dynamic = "force-dynamic";

export default async function MagazzinoPage() {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const [productsRaw, suppliers, movements] = await Promise.all([
    prisma.product.findMany({
      include: {
        supplier: true,
        stockMovements: { select: { quantity: true, movement: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.stockMovement.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        product: true,
        patient: true,
      },
    }),
  ]);

  const products = productsRaw.map((p) => {
    const stock = p.stockMovements.reduce((acc, m) => {
      return acc + (m.movement === "IN" ? m.quantity : -m.quantity);
    }, 0);
    return { ...p, stock };
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="col-span-2 space-y-8">
        {/* Products Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-600">Magazzino</p>
              <h1 className="text-2xl font-semibold text-zinc-900">Prodotti</h1>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-100">
              <thead className="bg-zinc-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3">Prodotto</th>
                  <th className="px-4 py-3">UDI-DI / SKU</th>
                  <th className="px-4 py-3">Fornitore</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Soglia</th>
                  <th className="px-4 py-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-sm">
                {products.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-zinc-600" colSpan={6}>
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
                          {p.udiDi || p.sku || "—"}
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
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <details className="inline-block rounded-lg border border-zinc-200 bg-white px-2 py-1 text-left text-xs text-zinc-700 shadow-sm [&_summary::-webkit-details-marker]:hidden">
                              <summary className="cursor-pointer font-semibold text-emerald-700">
                                Modifica
                              </summary>
                              <form action={updateProduct} className="mt-2 space-y-2">
                                <input type="hidden" name="productId" value={p.id} />
                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] font-semibold uppercase text-zinc-500">Nome</span>
                                  <input
                                    name="name"
                                    defaultValue={p.name}
                                    className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                    required
                                  />
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] font-semibold uppercase text-zinc-500">UDI-DI / SKU</span>
                                  <input
                                    name="udiDi"
                                    defaultValue={p.udiDi ?? p.sku ?? ""}
                                    className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                  />
                                  <input type="hidden" name="sku" value={p.sku ?? ""} />
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] font-semibold uppercase text-zinc-500">Tipo servizio</span>
                                  <input
                                    name="serviceType"
                                    defaultValue={p.serviceType ?? ""}
                                    className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                  />
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] font-semibold uppercase text-zinc-500">Soglia</span>
                                  <input
                                    type="number"
                                    name="minThreshold"
                                    defaultValue={p.minThreshold}
                                    className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                  />
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] font-semibold uppercase text-zinc-500">Fornitore</span>
                                  <select
                                    name="supplierId"
                                    defaultValue={p.supplierId ?? ""}
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
                                <button
                                  type="submit"
                                  className="w-full rounded-full bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"
                                >
                                  Salva
                                </button>
                              </form>
                            </details>
                          <ProductDeleteButton productId={p.id} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Movements Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Ultimi Movimenti</h2>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
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
                        {m.patient ? `${m.patient.firstName} ${m.patient.lastName}` : "—"}
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
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                          m.movement === "IN" 
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20" 
                            : "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10"
                        }`}>
                          {m.movement === "IN" ? "+" : "-"}{m.quantity}
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
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Nuovo fornitore</h2>
          <details className="group mt-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 shadow-sm [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between font-semibold text-emerald-700">
              Modifica fornitore
              <span className="text-[11px] text-zinc-500">(admin/manager)</span>
            </summary>
            <form action={updateSupplier} className="mt-2 space-y-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500">Fornitore</span>
                <select
                  name="supplierId"
                  className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  defaultValue=""
                  required
                >
                  <option value="" disabled>
                    Seleziona fornitore
                  </option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <input
                name="name"
                placeholder="Nome"
                className="h-9 w-full rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                required
              />
              <input
                name="email"
                placeholder="Email"
                className="h-9 w-full rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
              <input
                name="phone"
                placeholder="Telefono"
                className="h-9 w-full rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
              <textarea
                name="notes"
                placeholder="Note"
                className="w-full rounded-lg border border-zinc-200 px-2 py-1 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                rows={2}
              />
              <button
                type="submit"
                className="w-full rounded-full bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"
              >
                Salva modifiche
              </button>
            </form>
          </details>
          <form action={deleteSupplier} className="mt-2 flex items-center gap-2 text-xs text-rose-700">
            <select
              name="supplierId"
              className="h-9 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
              defaultValue=""
            >
              <option value="" disabled>
                Elimina fornitore…
              </option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50"
            >
              Elimina
            </button>
          </form>
          <form action={createSupplier} className="mt-3 space-y-3 text-sm">
            <input name="name" placeholder="Nome" required className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
            <input name="email" placeholder="Email" className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
            <input name="phone" placeholder="Telefono" className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
            <textarea name="notes" placeholder="Note" className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" rows={2} />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              Aggiungi fornitore
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Nuovo prodotto</h2>
          <form action={createProduct} className="mt-3 space-y-3 text-sm">
            <input name="name" placeholder="Nome prodotto" required className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
            <input name="sku" placeholder="SKU" className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
            <input name="udiDi" placeholder="UDI-DI" className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
            <input name="serviceType" placeholder="Tipo servizio (es. Igiene)" className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
            <input name="unitCost" placeholder="Costo unitario (€)" className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" type="number" step="0.01" min="0" />
            <input name="minThreshold" placeholder="Soglia minima" className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" type="number" min="0" defaultValue={0} />
            <select name="supplierId" className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100">
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
              Salva prodotto
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Movimento magazzino</h2>
          <form action={addStockMovement} className="mt-3 space-y-3 text-sm">
            <select name="productId" className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" required defaultValue="">
              <option value="" disabled>
                Seleziona prodotto
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input name="quantity" type="number" min="1" required className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" placeholder="Quantità" />
            <select name="movement" className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" required defaultValue="IN">
              <option value="IN">Carico</option>
              <option value="OUT">Scarico</option>
            </select>
            <input name="note" placeholder="Nota" className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              Registra movimento
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
