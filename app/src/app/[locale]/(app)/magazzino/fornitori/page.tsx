import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { createSupplier, deleteSupplier, updateSupplier } from "../actions";
import { PhoneInput } from "@/components/phone-input";

export const dynamic = "force-dynamic";

export default async function FornitoriPage() {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Magazzino</p>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Fornitori</h1>
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-200 dark:border-emerald-900/50 text-[13px] font-bold text-emerald-700 dark:text-emerald-400">
            +
          </span>
          Gestione fornitori
        </h2>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Aggiungi nuovi fornitori. Aggiorna fornitori esistenti.
        </p>
        <form action={createSupplier} className="mt-3 space-y-3 text-sm">
          <input
            name="name"
            placeholder="Nome"
            required
            className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-950/20"
          />
          <input
            name="email"
            placeholder="Email"
            className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-950/20"
          />
          <PhoneInput
            name="phone"
            placeholder="Telefono"
            className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-950/20"
          />
          <textarea
            name="notes"
            placeholder="Note"
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-950/20"
            rows={2}
          />
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            Aggiungi fornitore
          </button>
        </form>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Fornitori</h2>
        {suppliers.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-4 text-sm text-zinc-600 dark:text-zinc-400 shadow-sm">
            Nessun fornitore presente.
          </div>
        ) : (
          suppliers.map((supplier) => (
            <form
              key={supplier.id}
              action={updateSupplier}
              className="grid gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-4 text-sm shadow-sm sm:grid-cols-[2fr,3fr,2fr,auto] sm:items-end"
            >
              <input type="hidden" name="supplierId" value={supplier.id} />
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Nome</span>
                <input
                  name="name"
                  defaultValue={supplier.name}
                  className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-950/20"
                  required
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Email</span>
                  <input
                    name="email"
                    defaultValue={supplier.email ?? ""}
                    className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-950/20"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Telefono</span>
                  <PhoneInput
                    name="phone"
                    defaultValue={supplier.phone ?? ""}
                    className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-950/20"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Note</span>
                <input
                  name="notes"
                  defaultValue={supplier.notes ?? ""}
                  className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 text-sm text-zinc-900 dark:text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-950/20"
                />
              </label>
              <div className="flex items-center gap-2 pb-1 sm:pb-0">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full border border-emerald-200 dark:border-emerald-900/50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 transition hover:border-emerald-300 dark:hover:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                >
                  Aggiorna
                </button>
                <button
                  type="submit"
                  formAction={deleteSupplier}
                  data-confirm="Eliminare definitivamente questo fornitore?"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 dark:border-rose-900/50 px-3 py-2 text-[11px] font-semibold text-rose-700 dark:text-rose-400 transition hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
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
