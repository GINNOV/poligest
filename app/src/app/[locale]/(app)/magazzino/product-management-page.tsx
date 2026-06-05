import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Prisma, Role } from "@prisma/client";
import { createProduct, deleteProduct, updateProduct } from "./actions";

type ProductManagementPageProps = {
  mode: "products" | "implants";
  searchParams?: Promise<{ q?: string }>;
};

export default async function ProductManagementPage({ mode, searchParams }: ProductManagementPageProps) {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const resolvedParams = searchParams ? await searchParams : undefined;
  const isImplantsPage = mode === "implants";
  const title = isImplantsPage ? "Impianti" : "Prodotti";
  const listTitle = isImplantsPage ? "Elenco impianti" : "Elenco prodotti";
  const emptyLabel = isImplantsPage ? "Nessun impianto presente." : "Nessun prodotto presente.";
  const searchPlaceholder = isImplantsPage ? "Cerca impianti" : "Cerca prodotti";
  const query = typeof resolvedParams?.q === "string" ? resolvedParams.q.trim() : "";
  const implantFilter: Prisma.ProductWhereInput = {
    OR: [
      { name: { contains: "impianto", mode: Prisma.QueryMode.insensitive } },
      { serviceType: { contains: "impianto", mode: Prisma.QueryMode.insensitive } },
    ],
  };
  const searchFilter: Prisma.ProductWhereInput | undefined = query
    ? {
        OR: [
          { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { sku: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { brand: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { serviceType: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { udiDi: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { udiPi: { contains: query, mode: Prisma.QueryMode.insensitive } },
        ],
      }
    : undefined;
  const productFilters = [
    isImplantsPage ? implantFilter : { NOT: implantFilter },
    ...(searchFilter ? [searchFilter] : []),
  ];
  const [productsRaw, suppliers] = await Promise.all([
    prisma.product.findMany({
      where: { AND: productFilters },
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
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Magazzino</p>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{title}</h1>
      </div>

      <div className="grid gap-4">
        {isImplantsPage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-200 text-[13px] font-bold text-emerald-700 dark:border-emerald-900/40 dark:text-emerald-400">
              +
            </span>
            Registra impianto
          </h2>
          <form action={createProduct} className="mt-3 space-y-3 text-sm">
            <input type="hidden" name="isImplant" value="1" />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Nome</span>
                <input
                  name="name"
                  placeholder="Nome prodotto"
                  required
                  defaultValue="IMPIANTO 2026"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Fornitore</span>
                <select
                  name="supplierId"
                  required
                  defaultValue=""
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
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
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">SKU</span>
                <input
                  name="sku"
                  placeholder="SKU"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Marca</span>
                <input
                  name="brand"
                  placeholder="Marca"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Tipo Prodotto</span>
                <input
                  name="serviceType"
                  placeholder="es. impianto"
                  defaultValue="impianto"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
                />
              </label>
            </div>
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(8rem,0.7fr)_minmax(8rem,0.7fr)]">
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Codice UDI-DI</span>
                <input
                  name="udiDi"
                  placeholder="(01)72901086921981"
                  autoComplete="off"
                  required
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 font-mono text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Codice UDI-PI</span>
                <input
                  name="udiPi"
                  placeholder="(17)291209(10)WO-031358(21)22-70007"
                  autoComplete="off"
                  required
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 font-mono text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Costo unitario</span>
                <input
                  name="unitCost"
                  placeholder="Costo unitario (€)"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
                  type="number"
                  step="0.01"
                  min="0"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Soglia minima</span>
                <input
                  name="minThreshold"
                  placeholder="Soglia minima"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
                  type="number"
                  min="0"
                  defaultValue={0}
                />
              </label>
            </div>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              Registra impianto
            </button>
          </form>
        </div>
        ) : (

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-200 text-[13px] font-bold text-emerald-700 dark:border-emerald-900/40 dark:text-emerald-400">
              +
            </span>
            Aggiungi prodotto
          </h2>
          <form action={createProduct} className="mt-3 space-y-3 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Nome</span>
                <input
                  name="name"
                  placeholder="Nome prodotto"
                  required
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Fornitore</span>
                <select
                  name="supplierId"
                  required
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
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
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">SKU</span>
                <input
                  name="sku"
                  placeholder="SKU"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Marca</span>
                <input
                  name="brand"
                  placeholder="Marca"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Tipo Prodotto</span>
                <input
                  name="serviceType"
                  placeholder="es. impianto"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Costo unitario</span>
              <input
                name="unitCost"
                placeholder="Costo unitario (€)"
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
                type="number"
                step="0.01"
                min="0"
              />
            </label>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              Aggiungi
            </button>
          </form>
        </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{listTitle}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <form method="get" className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                name="q"
                placeholder={searchPlaceholder}
                defaultValue={query}
                className="h-9 w-56 rounded-full border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
              />
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50"
              >
                Cerca
              </button>
            </form>
          </div>
        </div>
        {products.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            {emptyLabel}
          </div>
        ) : (
          products.map((product) => (
            <form
              key={product.id}
              action={updateProduct}
              className="grid gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-[3fr,3fr,auto] sm:items-end"
            >
              <input type="hidden" name="productId" value={product.id} />
              {isImplantsPage ? <input type="hidden" name="isImplant" value="1" /> : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Nome</span>
                  <input
                    name="name"
                    defaultValue={product.name}
                    className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Fornitore</span>
                  <select
                    name="supplierId"
                    defaultValue={product.supplierId ?? ""}
                    required
                    className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
                  >
                    <option value="" disabled>
                      Seleziona
                    </option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-3 lg:grid-cols-4">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">SKU</span>
                  <input
                    name="sku"
                    defaultValue={product.sku ?? ""}
                    className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Marca</span>
                  <input
                    name="brand"
                    defaultValue={product.brand ?? ""}
                    className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Tipo Prodotto</span>
                  <input
                    name="serviceType"
                    defaultValue={product.serviceType ?? ""}
                    className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Soglia</span>
                  <input
                    type="number"
                    name="minThreshold"
                    defaultValue={product.minThreshold ?? 0}
                    className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1 lg:col-span-2">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Codice UDI-DI</span>
                  <input
                    name="udiDi"
                    defaultValue={product.udiDi ?? ""}
                    placeholder="(01)72901086921981"
                    autoComplete="off"
                    required={isImplantsPage}
                    className="h-9 rounded-lg border border-zinc-200 bg-white px-2 font-mono text-xs text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1 lg:col-span-2">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Codice UDI-PI</span>
                  <input
                    name="udiPi"
                    defaultValue={product.udiPi ?? ""}
                    placeholder="(17)291209(10)WO-031358(21)22-70007"
                    autoComplete="off"
                    required={isImplantsPage}
                    className="h-9 rounded-lg border border-zinc-200 bg-white px-2 font-mono text-xs text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/20"
                  />
                </label>
              </div>
              <div className="flex items-center gap-2 pb-1 sm:pb-0">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-950/20"
                >
                  Aggiorna
                </button>
                <button
                  type="submit"
                  formAction={deleteProduct}
                  data-confirm="Eliminare definitivamente questo prodotto e i movimenti collegati?"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 px-3 py-2 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path
                      fillRule="evenodd"
                      d="M7 2a2 2 0 00-2 2v1H3.5a.5.5 0 000 1h13a.5.5 0 000-1H15V4a2 2 0 00-2-2H7zm6 3V4a1 1 0 00-1-1H8a1 1 0 00-1 1v1h6zm-8 2a.5.5 0 01.5-.5h9a.5.5 0 01.5.5v8a2 2 0 01-2 2H7a2 2 0 01-2-2V7zm2.5.5a.5.5 0 00-1 0v7a.5.5 0 001 0v-7zm3 0a.5.5 0 10-1 0v7a.5.5 0 001 0v-7zm2.5 0a.5.5 0 00-1 0v7a.5.5 0 001 0v-7z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Elimina
                </button>
              </div>
            </form>
          ))
        )}
      </div>
    </div>
  );
}
