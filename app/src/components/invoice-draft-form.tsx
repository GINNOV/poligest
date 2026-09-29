"use client";

import { useMemo, useState } from "react";
import { issueInvoiceAction } from "@/lib/finance/invoice-actions";
import { Button } from "@/components/ui/button";

export type InvoiceDraftLine = {
  key: string;
  serviceName: string;
  serviceDate: string;
  quantity: number;
  totalLabel: string;
  total: number;
};

export type InvoiceDraftGroup = {
  quoteId: string;
  title: string;
  lines: InvoiceDraftLine[];
};

export function InvoiceDraftForm({
  patientId,
  groups,
}: {
  patientId: string;
  groups: InvoiceDraftGroup[];
}) {
  const lines = useMemo(() => groups.flatMap((group) => group.lines), [groups]);
  const [checked, setChecked] = useState<string[]>([]);
  const [error, setError] = useState("");

  const total = lines
    .filter((line) => checked.includes(line.key))
    .reduce((sum, line) => sum + Math.round(line.total * 100), 0) / 100;

  return (
    <form
      action={issueInvoiceAction}
      onSubmit={(event) => {
        const selected = new FormData(event.currentTarget).getAll("source");
        if (selected.length === 0) {
          event.preventDefault();
          setError("Seleziona almeno una riga.");
          return;
        }
        setError("");
      }}
      className="space-y-4"
    >
      <input type="hidden" name="patientId" value={patientId} />
      {groups.map((group) => (
        <section key={group.quoteId} className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <h2 className="border-b border-zinc-100 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
            {group.title}
          </h2>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {group.lines.map((line) => (
              <li key={line.key}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    name="source"
                    value={line.key}
                    checked={checked.includes(line.key)}
                    onChange={(event) => {
                      setError("");
                      setChecked((current) =>
                        event.target.checked
                          ? [...current, line.key]
                          : current.filter((key) => key !== line.key),
                      );
                    }}
                    className="h-4 w-4 rounded border-zinc-300 text-emerald-700"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-zinc-900 dark:text-zinc-50">{line.serviceName}</span>
                    <span className="text-xs text-zinc-500">{line.serviceDate}</span>
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-300">× {line.quantity}</span>
                  <span className="w-20 text-right font-medium text-zinc-900 dark:text-zinc-50">{line.totalLabel}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Totale selezionato <span className="font-semibold text-zinc-900 dark:text-zinc-50">{total.toFixed(2)}</span>
        </p>
        <Button type="submit">Emetti fattura</Button>
      </div>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </form>
  );
}
