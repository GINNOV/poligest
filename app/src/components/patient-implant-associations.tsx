"use client";

import { useMemo, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";

export type ImplantProductOption = {
  id: string;
  name: string;
  sku: string | null;
  brand: string | null;
  supplierName: string | null;
  udiDi: string | null;
  udiPi: string | null;
  serviceType: string | null;
};

export type PatientImplantAssociationItem = {
  id: string;
  productId: string;
  productName: string;
  brand: string | null;
  supplierName: string | null;
  udiDi: string | null;
  udiPi: string | null;
  purchaseDate: string;
  interventionDate: string;
  interventionSite: string | null;
};

type FormMode =
  | { type: "create"; product: ImplantProductOption | null }
  | { type: "edit"; association: PatientImplantAssociationItem };

type Props = {
  patientId: string;
  products: ImplantProductOption[];
  implants: PatientImplantAssociationItem[];
  addAction: (formData: FormData) => Promise<void>;
  updateAction: (formData: FormData) => Promise<void>;
};

const emptyCreateMode: FormMode = { type: "create", product: null };

function displayValue(value: string | null | undefined) {
  return value?.trim() || "—";
}

function formatDateLabel(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : "—";
}

function productSearchText(product: ImplantProductOption) {
  return [
    product.name,
    product.brand,
    product.supplierName,
    product.sku,
    product.udiDi,
    product.udiPi,
    product.serviceType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function fieldClasses(readOnly = false) {
  return [
    "h-11 rounded-lg border px-3 text-sm outline-none transition",
    readOnly
      ? "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
      : "border-zinc-200 bg-white text-zinc-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900",
  ].join(" ");
}

function ImplantRecordSearchDialog({
  products,
  onClose,
  onSelect,
}: {
  products: ImplantProductOption[];
  onClose: () => void;
  onSelect: (product: ImplantProductOption) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleProducts = useMemo(() => {
    if (!normalizedQuery) return products;
    return products.filter((product) => productSearchText(product).includes(normalizedQuery));
  }, [normalizedQuery, products]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="implant-search-title"
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div>
            <h2 id="implant-search-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Seleziona impianto
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Cerca nei record di magazzino per nome, marca, SKU o codici UDI.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi selezione impianto"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400" htmlFor="implant-search">
            Cerca record
          </label>
          <input
            id="implant-search"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
            placeholder="Nome, marca, UDI-DI, UDI-PI..."
          />
        </div>
        <div className="overflow-y-auto p-4">
          {visibleProducts.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              Nessun impianto trovato.
            </p>
          ) : (
            <div className="grid gap-3">
              {visibleProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onSelect(product)}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40 focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{product.name}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {[product.brand, product.supplierName, product.serviceType].filter(Boolean).join(" · ") || "Dati prodotto"}
                      </p>
                    </div>
                    <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Seleziona
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-zinc-600 dark:text-zinc-300 sm:grid-cols-3">
                    <span>UDI-DI: <span className="font-mono">{displayValue(product.udiDi)}</span></span>
                    <span>UDI-PI: <span className="font-mono">{displayValue(product.udiPi)}</span></span>
                    <span>SKU: <span className="font-mono">{displayValue(product.sku)}</span></span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SelectedImplantDetails({
  patientId,
  mode,
  addAction,
  updateAction,
  onSelectRequest,
  onResetCreate,
}: {
  patientId: string;
  mode: FormMode;
  addAction: (formData: FormData) => Promise<void>;
  updateAction: (formData: FormData) => Promise<void>;
  onSelectRequest: () => void;
  onResetCreate: () => void;
}) {
  const isEdit = mode.type === "edit";
  const product = isEdit
    ? {
        id: mode.association.productId,
        name: mode.association.productName,
        brand: mode.association.brand,
        supplierName: mode.association.supplierName,
        udiDi: mode.association.udiDi,
        udiPi: mode.association.udiPi,
        sku: null,
        serviceType: null,
      }
    : mode.product;
  const formAction = isEdit ? updateAction : addAction;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900/40 dark:bg-zinc-950 dark:text-emerald-400">
        <span>{isEdit ? "Modifica impianto" : "Dettagli impianto"}</span>
        <svg
          className="h-4 w-4 text-emerald-700 dark:text-emerald-500"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path fillRule="evenodd" d="M14.77 12.79a.75.75 0 0 1-1.06-.02L10 9.06l-3.71 3.71a.75.75 0 1 1-1.06-1.06l4.24-4.24a.75.75 0 0 1 1.06 0l4.24 4.24a.75.75 0 0 1 .02 1.08Z" clipRule="evenodd" />
        </svg>
      </div>

      <form action={formAction} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input type="hidden" name="patientId" value={patientId} />
        {isEdit ? <input type="hidden" name="implantId" value={mode.association.id} /> : null}
        {product ? <input type="hidden" name="productId" value={product.id} /> : null}

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Prodotto / Tipo di DM
          <div className="flex gap-2">
            <input
              value={product?.name ?? ""}
              readOnly
              placeholder="Seleziona un impianto dal magazzino"
              className={`${fieldClasses(true)} flex-1`}
            />
            {!isEdit ? (
              <button
                type="button"
                onClick={onSelectRequest}
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold uppercase tracking-wider text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
              >
                Seleziona
              </button>
            ) : null}
          </div>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Marca
          <input value={product?.brand ?? product?.supplierName ?? ""} readOnly placeholder="Marca" className={fieldClasses(true)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Codice UDI-DI
          <input value={product?.udiDi ?? ""} readOnly placeholder="UDI-DI" className={`${fieldClasses(true)} font-mono text-xs`} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Codice UDI-PI
          <input value={product?.udiPi ?? ""} readOnly placeholder="UDI-PI / Lotto" className={`${fieldClasses(true)} font-mono text-xs`} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Data acquisto
          <input
            type="date"
            name="purchaseDate"
            defaultValue={isEdit ? mode.association.purchaseDate : ""}
            className={fieldClasses()}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Data intervento
          <input
            type="date"
            name="interventionDate"
            defaultValue={isEdit ? mode.association.interventionDate : ""}
            className={fieldClasses()}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200 sm:col-span-2">
          Sede intervento
          <input
            name="interventionSite"
            defaultValue={isEdit ? mode.association.interventionSite ?? "" : ""}
            className={fieldClasses()}
            placeholder="Es. 1.1, 2.4..."
          />
        </label>
        <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
          {isEdit ? (
            <button
              type="button"
              onClick={onResetCreate}
              className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-200 px-5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Nuovo impianto
            </button>
          ) : null}
          <FormSubmitButton
            disabled={!product}
            className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            pendingLabel={isEdit ? "Aggiornamento..." : "Associazione..."}
          >
            {isEdit ? "Aggiorna dati" : "Associa impianto"}
          </FormSubmitButton>
        </div>
      </form>
    </div>
  );
}

export function PatientImplantAssociations({ patientId, products, implants, addAction, updateAction }: Props) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>(emptyCreateMode);

  return (
    <details className="group rounded-2xl border border-zinc-200 bg-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 [&_summary::-webkit-details-marker]:hidden" open>
      <summary className="flex cursor-pointer items-center justify-between gap-3 border-b border-zinc-200 pb-4 text-base font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
        <span className="flex items-center gap-3">
          <svg
            className="h-8 w-8 text-emerald-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
            <path d="M14 3v5h5" />
          </svg>
          <span className="uppercase tracking-wide">Associa impianti</span>
        </span>
        <svg
          className="h-5 w-5 text-zinc-600 transition-transform duration-200 group-open:rotate-180 dark:text-zinc-300"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <p className="pt-4 text-sm text-zinc-600 dark:text-zinc-300">
        Registra impianti/protesi collegati al paziente utilizzando i dati di magazzino.
      </p>

      <div className="mt-4 space-y-4">
        <div className="relative overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="min-w-full divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-3 text-left">Tipo di DM</th>
                <th className="px-3 py-3 text-left">Marca</th>
                <th className="px-3 py-3 text-left">UDI-DI</th>
                <th className="px-3 py-3 text-left">UDI-PI</th>
                <th className="px-3 py-3 text-left">Data acquisto</th>
                <th className="px-3 py-3 text-left">Data intervento</th>
                <th className="px-3 py-3 text-left">Sede intervento</th>
                <th className="px-3 py-3 text-left">Modifica</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {implants.length === 0 ? (
                <tr>
                  <td className="px-3 py-5 text-sm text-zinc-600 dark:text-zinc-400" colSpan={8}>
                    Nessun impianto associato.
                  </td>
                </tr>
              ) : (
                implants.map((implant) => (
                  <tr key={implant.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <td className="px-3 py-3 font-medium text-zinc-900 dark:text-zinc-50">{implant.productName}</td>
                    <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">{displayValue(implant.brand ?? implant.supplierName)}</td>
                    <td className="px-3 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">{displayValue(implant.udiDi)}</td>
                    <td className="px-3 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">{displayValue(implant.udiPi)}</td>
                    <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">{formatDateLabel(implant.purchaseDate)}</td>
                    <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">{formatDateLabel(implant.interventionDate)}</td>
                    <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">{displayValue(implant.interventionSite)}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setFormMode({ type: "edit", association: implant })}
                        className="inline-flex h-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                      >
                        Modifica
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <SelectedImplantDetails
          patientId={patientId}
          mode={formMode}
          addAction={addAction}
          updateAction={updateAction}
          onSelectRequest={() => setIsSearchOpen(true)}
          onResetCreate={() => setFormMode(emptyCreateMode)}
        />
      </div>

      {isSearchOpen ? (
        <ImplantRecordSearchDialog
          products={products}
          onClose={() => setIsSearchOpen(false)}
          onSelect={(product) => {
            setFormMode({ type: "create", product });
            setIsSearchOpen(false);
          }}
        />
      ) : null}
    </details>
  );
}
