import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { PrintButton } from "@/components/print-button";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lista prodotti",
};

type ProdottiPrintPageProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function ProdottiPrintPage({ searchParams }: ProdottiPrintPageProps) {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const resolvedParams = searchParams ? await searchParams : undefined;
  const query = typeof resolvedParams?.q === "string" ? resolvedParams.q.trim() : "";

  const productsRaw = await prisma.product.findMany({
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
  });

  const products = productsRaw.map((p) => {
    const stock = p.stockMovements.reduce((acc, m) => {
      return acc + (m.movement === "IN" ? m.quantity : -m.quantity);
    }, 0);
    return { ...p, stock };
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
                Lista prodotti
              </p>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Studio Agovino & Angrisano</h1>
              {query ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Filtro: {query}</p>
              ) : null}
            </div>
          </div>
          <PrintButton
            className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600 print:hidden"
            label="Stampa lista prodotti"
          />
        </div>

        <div className="relative overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white/90 to-transparent dark:from-zinc-950/90 sm:hidden" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white/90 to-transparent dark:from-zinc-950/90 sm:hidden" />
          <table className="min-w-full divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 text-left">Prodotto</th>
                <th className="px-4 py-3 text-left">UDI-DI / UDI-PI</th>
                <th className="px-4 py-3 text-left">Fornitore</th>
                <th className="px-4 py-3 text-left">Stock</th>
                <th className="px-4 py-3 text-left">Soglia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {products.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-zinc-600 dark:text-zinc-400" colSpan={5}>
                    Nessun prodotto a catalogo.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const low = p.stock <= p.minThreshold;
                  return (
                    <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-50">{p.name}</span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">{p.serviceType ?? "Generico"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        <div className="flex flex-col gap-0.5">
                          <span>UDI-DI {p.udiDi ?? "—"}</span>
                          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">UDI-PI {p.udiPi ?? "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{p.supplier?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            low ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" : "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                          }`}
                        >
                          {p.stock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{p.minThreshold}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
