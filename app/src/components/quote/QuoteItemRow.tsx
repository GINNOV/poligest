"use client";

import clsx from "clsx";

type ServiceOption = {
  id: string;
  name: string;
  costBasis: number;
};

interface QuoteItemRowProps {
  index: number;
  item: {
    id: string;
    dentalRecordId: string | null;
    serviceId: string;
    serviceDate: string;
    quantity: string;
    price: string;
    treated: boolean;
    tooth: number | null;
    createdAt: string | null;
    totalValue: number;
    isSettled: boolean;
  };
  sortedServices: ServiceOption[];
  onUpdate: (index: number, next: any) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  canRemove: boolean;
  formatItemDate: (value?: string | null) => string | null;
}

export function QuoteItemRow({
  index,
  item,
  sortedServices,
  onUpdate,
  onRemove,
  onAdd,
  canRemove,
  formatItemDate,
}: QuoteItemRowProps) {
  return (
    <div
      className={clsx(
        "grid grid-cols-1 gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-[1fr_60px_100px_100px_140px_auto]",
        item.isSettled
          ? "border-emerald-500 bg-emerald-500/10 dark:border-emerald-400 dark:bg-emerald-400/5"
          : item.dentalRecordId 
            ? "border-sky-300 bg-sky-100/50 dark:border-sky-800 dark:bg-sky-900/20" 
            : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50"
      )}
    >
      <label className="flex min-w-0 flex-col gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-300 lg:col-span-1">
        Prestazione
        <select
          value={item.serviceId}
          disabled={item.isSettled}
          onChange={(event) => {
            const nextServiceId = event.target.value;
            const nextService = sortedServices.find((service) => service.id === nextServiceId);
            onUpdate(index, {
              serviceId: nextServiceId,
              price: Number(item.price) === 0 ? String(nextService?.costBasis ?? "") : item.price,
            });
          }}
          className="h-11 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900/20 disabled:opacity-60 disabled:bg-zinc-100 dark:disabled:bg-zinc-950 uppercase"
          required
        >
          <option value="" disabled>
            Seleziona servizio
          </option>
          {sortedServices.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 flex-col gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-300">
        Qtà
        <input
          type="number"
          min="1"
          step="1"
          disabled={item.isSettled}
          inputMode="numeric"
          pattern="[0-9]*"
          value={item.quantity}
          onChange={(event) => {
            const nextValue = event.target.value.replace(/\D+/g, "");
            onUpdate(index, { quantity: nextValue });
          }}
          className="h-11 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1 text-center text-sm text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900/20 disabled:opacity-60 disabled:bg-zinc-100 dark:disabled:bg-zinc-950 font-mono"
        />
      </label>
      <label className="flex min-w-0 flex-col gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-300">
        Prezzo
        <input
          type="number"
          min="0"
          step="0.01"
          disabled={item.isSettled}
          value={item.price}
          onChange={(event) => onUpdate(index, { price: event.target.value })}
          className="h-11 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900/20 disabled:opacity-60 disabled:bg-zinc-100 dark:disabled:bg-zinc-950 font-mono"
        />
      </label>
      <label className="flex min-w-0 flex-col gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-300">
        Totale
        <input
          type="text"
          value={item.totalValue.toFixed(2)}
          readOnly
          className="h-11 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none opacity-60 disabled:bg-zinc-100 dark:disabled:bg-zinc-950 font-mono"
          disabled={item.isSettled}
        />
      </label>
      <label className="flex min-w-0 flex-col gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-300">
        Data prestazione
        <input
          type="date"
          disabled={item.isSettled}
          value={item.serviceDate}
          onChange={(event) => onUpdate(index, { serviceDate: event.target.value })}
          className="h-11 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900/20 disabled:opacity-60 disabled:bg-zinc-100 dark:disabled:bg-zinc-950 uppercase"
          required
        />
      </label>
      <div className="flex items-end justify-start gap-2">
        {item.isSettled ? (
          <div className="h-11 flex items-center px-4">
            <span className="rounded-full bg-blue-950 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-white shadow-sm ring-1 ring-blue-900">
              OKAY
            </span>
          </div>
        ) : !(item.treated || item.dentalRecordId) ? (
          <>
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-emerald-200 dark:border-emerald-900 text-lg font-semibold text-emerald-700 dark:text-emerald-500 transition hover:border-emerald-300 dark:hover:border-emerald-800 hover:text-emerald-800 dark:hover:text-emerald-400"
              aria-label="Aggiungi prestazione"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-800 text-lg font-semibold text-zinc-600 dark:text-zinc-400 transition hover:border-rose-200 dark:hover:border-rose-900/50 hover:text-rose-600 dark:hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Rimuovi prestazione"
              disabled={!canRemove}
            >
              −
            </button>
          </>
        ) : (
          <div className="h-11 flex items-center px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-600 italic">
            Collegato al diario
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 sm:col-span-2 lg:col-span-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {(() => {
            const d = formatItemDate(item.createdAt);
            return d ? <span>Aggiunto: {d}</span> : null;
          })()}
          {item.tooth != null ? (
            <>
              <span className="text-zinc-300 dark:text-zinc-700">•</span>
              <span>Dente: <span className="text-blue-900 dark:text-blue-400 font-black">{item.tooth === 0 ? "Bocca intera" : item.tooth}</span></span>
            </>
          ) : null}
          <span className="text-zinc-300 dark:text-zinc-700">•</span>
          <div className="flex items-center gap-1.5">
            <span>Stato:</span>
            {item.treated === false ? (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-500/30">
                In corso
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-500/30">
                Trattato
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
