"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createService, deleteService, updateService } from "@/lib/admin/services-actions";

export type ServiceCatalogItem = {
  id: string;
  name: string;
  description: string | null;
  costBasis: string;
};

type ServicesCatalogProps = {
  services: ServiceCatalogItem[];
  totalCount: number;
  query: string;
  exactMatchId: string | null;
  labels: {
    createTitle: string;
    createHint: string;
    name: string;
    namePlaceholder: string;
    description: string;
    descriptionPlaceholder: string;
    cost: string;
    createButton: string;
    listTitle: string;
    searchLabel: string;
    searchPlaceholder: string;
    apply: string;
    reset: string;
    empty: string;
    noResults: string;
    exactMatch: string;
    resultsCount: string;
    edit: string;
    cancel: string;
    save: string;
    delete: string;
    noDescription: string;
  };
};

const inputClassName =
  "h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-emerald-500/10";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

function formatCost(value: string) {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return value;
  return currencyFormatter.format(parsed);
}

function truncateText(value: string | null, maxLength = 72) {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.trim().toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index < 0) return text;

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-emerald-100 px-0.5 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100">
        {text.slice(index, index + query.trim().length)}
      </mark>
      {text.slice(index + query.trim().length)}
    </>
  );
}

export function ServicesCatalog({
  services,
  totalCount,
  query,
  exactMatchId,
  labels,
}: ServicesCatalogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{labels.createTitle}</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{labels.createHint}</p>
          </div>
        </div>

        <form action={createService} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_auto] md:items-end">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {labels.name}
            <input
              name="name"
              required
              className={inputClassName}
              placeholder={labels.namePlaceholder}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {labels.cost}
            <input
              name="costBasis"
              type="number"
              step="0.01"
              min="0"
              required
              className={inputClassName}
              placeholder="0.00"
            />
          </label>
          <Button type="submit" variant="primary" className="h-10">
            {labels.createButton}
          </Button>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200 md:col-span-3">
            {labels.description}
            <textarea
              name="description"
              rows={2}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-emerald-500/10"
              placeholder={labels.descriptionPlaceholder}
            />
          </label>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{labels.listTitle}</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {query
                ? labels.resultsCount
                    .replace("{count}", String(services.length))
                    .replace("{total}", String(totalCount))
                : `${totalCount} ${totalCount === 1 ? "servizio" : "servizi"}`}
            </p>
          </div>

          <form method="get" className="flex w-full max-w-xl flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {labels.searchLabel}
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder={labels.searchPlaceholder}
                className={inputClassName}
              />
            </label>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" className="h-10">
                {labels.apply}
              </Button>
              {query ? (
                <Link
                  href="/admin/servizi"
                  className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-emerald-800 dark:hover:text-emerald-500"
                >
                  {labels.reset}
                </Link>
              ) : null}
            </div>
          </form>
        </div>

        {exactMatchId ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            {labels.exactMatch}
          </div>
        ) : null}

        {services.length === 0 ? (
          <p className="mt-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
            {query ? labels.noResults : labels.empty}
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Costo base</th>
                  <th className="hidden px-4 py-3 md:table-cell">Descrizione</th>
                  <th className="px-4 py-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                {services.map((service) => {
                  const isEditing = editingId === service.id;
                  const isExactMatch = service.id === exactMatchId;

                  return (
                    <tr
                      key={service.id}
                      className={isExactMatch ? "bg-amber-50/80 dark:bg-amber-950/20" : undefined}
                    >
                      {isEditing ? (
                        <td colSpan={4} className="px-4 py-4">
                          <form action={updateService} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <input type="hidden" name="serviceId" value={service.id} />
                            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                              {labels.name}
                              <input
                                name="name"
                                defaultValue={service.name}
                                required
                                className={inputClassName}
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                              {labels.cost}
                              <input
                                name="costBasis"
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={service.costBasis}
                                required
                                className={inputClassName}
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200 md:col-span-2">
                              {labels.description}
                              <textarea
                                name="description"
                                rows={3}
                                defaultValue={service.description ?? ""}
                                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-emerald-500/10"
                                placeholder={labels.descriptionPlaceholder}
                              />
                            </label>
                            <div className="flex flex-wrap gap-2 md:col-span-2">
                              <Button type="submit" variant="primary" size="sm">
                                {labels.save}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setEditingId(null)}
                              >
                                {labels.cancel}
                              </Button>
                            </div>
                          </form>
                        </td>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                            {highlightMatch(service.name, query)}
                          </td>
                          <td className="px-4 py-3 font-mono text-zinc-700 dark:text-zinc-300">
                            {formatCost(service.costBasis)}
                          </td>
                          <td className="hidden px-4 py-3 text-zinc-600 dark:text-zinc-400 md:table-cell">
                            {service.description ? (
                              highlightMatch(truncateText(service.description) ?? service.description, query)
                            ) : (
                              <span className="text-zinc-400 dark:text-zinc-500">{labels.noDescription}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setEditingId(service.id)}
                              >
                                {labels.edit}
                              </Button>
                              <form
                                action={deleteService}
                                data-confirm="Eliminare definitivamente questo servizio?"
                              >
                                <input type="hidden" name="serviceId" value={service.id} />
                                <Button type="submit" variant="destructive" size="sm">
                                  {labels.delete}
                                </Button>
                              </form>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}