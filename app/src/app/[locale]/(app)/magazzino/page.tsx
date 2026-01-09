import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { format } from "date-fns";

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
          </Link>
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

    </div>
  );
}
