import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role, StockMovementType } from "@prisma/client";

async function createSupplier(formData: FormData) {
  "use server";

  await requireUser([Role.ADMIN, Role.MANAGER]);
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;
  if (!name) throw new Error("Nome fornitore obbligatorio");

  await prisma.supplier.create({ data: { name, email, phone, notes } });
  revalidatePath("/magazzino");
}

async function createProduct(formData: FormData) {
  "use server";

  await requireUser([Role.ADMIN, Role.MANAGER]);
  const name = (formData.get("name") as string)?.trim();
  const sku = (formData.get("sku") as string)?.trim() || null;
  const serviceType = (formData.get("serviceType") as string)?.trim() || null;
  const unitCostRaw = (formData.get("unitCost") as string)?.trim();
  const minThreshold = Number(formData.get("minThreshold")) || 0;
  const supplierId = (formData.get("supplierId") as string) || null;
  if (!name) throw new Error("Nome prodotto obbligatorio");

  await prisma.product.create({
    data: {
      name,
      sku,
      serviceType,
      unitCost: unitCostRaw ? unitCostRaw : null,
      minThreshold,
      supplierId,
    },
  });

  revalidatePath("/magazzino");
}

async function addStockMovement(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const productId = formData.get("productId") as string;
  const quantity = Number(formData.get("quantity"));
  const movement = formData.get("movement") as StockMovementType;
  const note = (formData.get("note") as string)?.trim() || null;
  if (!productId || !movement || Number.isNaN(quantity) || quantity === 0) {
    throw new Error("Dati movimento non validi");
  }

  await prisma.stockMovement.create({
    data: {
      productId,
      quantity: Math.abs(quantity),
      movement,
      note,
      userId: user.id,
    },
  });

  revalidatePath("/magazzino");
}

export default async function MagazzinoPage() {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const [productsRaw, suppliers] = await Promise.all([
    prisma.product.findMany({
      include: {
        supplier: true,
        stockMovements: { select: { quantity: true, movement: true } },
      },
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="col-span-2 space-y-4">
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
                <th className="px-4 py-3">Fornitore</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Soglia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-sm">
              {products.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-zinc-600" colSpan={4}>
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
                            {p.sku ?? "—"} · {p.serviceType ?? "Generico"}
                          </span>
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

      <div className="space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Nuovo fornitore</h2>
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
