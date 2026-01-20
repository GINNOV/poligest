"use client";

import { useMemo, useState } from "react";

type PatientOption = { id: string; fullName: string };
type DiaryOption = { id: string; patientId: string; label: string; performedAt: string };
type SupplierOption = { id: string; name: string };
type ProductOption = { id: string; name: string };

type IncomeProps = {
  patients: PatientOption[];
  diaryOptions: DiaryOption[];
};

export function FinanceIncomeFields({ patients, diaryOptions }: IncomeProps) {
  const [patientId, setPatientId] = useState<string>("");

  const patientDiaryEntries = useMemo(() => {
    if (!patientId) return [];
    const entries = diaryOptions.filter((d) => d.patientId === patientId);
    return entries.sort((a, b) => a.label.localeCompare(b.label, "it", { sensitivity: "base" }));
  }, [diaryOptions, patientId]);

  const selectedPatient = patients.find((p) => p.id === patientId);

  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
        Paziente
        <select
          name="patientId"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          required
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        >
          <option value="" disabled>
            Seleziona paziente
          </option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
        Data di erogazione
        <input
          type="date"
          name="deliveredAt"
          required
          className="h-11 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
        Prestazione erogata (diario clinico)
        <select
          name="deliveredItemId"
          required
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          disabled={!patientId}
          defaultValue=""
        >
          <option value="" disabled>
            {patientId ? "Seleziona una voce dal diario" : "Scegli prima un paziente"}
          </option>
          {patientDiaryEntries.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label} · {new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(entry.performedAt))}
            </option>
          ))}
        </select>
        {selectedPatient && patientDiaryEntries.length === 0 ? (
          <span className="text-xs text-amber-600">
            Nessuna voce di diario per questo paziente: aggiungi una procedura prima di registrare il pagamento.
          </span>
        ) : (
          <span className="text-xs text-zinc-500">
            Lista compilata automaticamente dal diario clinico del paziente.
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
        Importo
        <input
          name="amount"
          type="number"
          min="0"
          step="0.01"
          required
          className="h-11 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        />
      </label>

      <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-800">
        <input
          type="checkbox"
          name="partialPayment"
          value="1"
          className="h-4 w-4 rounded border-zinc-300"
        />
        Pagamento parziale
      </label>
    </div>
  );
}

type ExpenseProps = {
  suppliers: SupplierOption[];
  products: ProductOption[];
};

export function FinanceExpenseFields({ suppliers, products }: ExpenseProps) {
  const [expenseKind, setExpenseKind] = useState<string>("service");
  const [paymentType, setPaymentType] = useState<string>("electronic");

  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
        Descrizione
        <input
          name="expenseDescription"
          required
          className="h-11 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          placeholder="Es. Acquisto materiali, manutenzione..."
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
        Fornitore
        <select
          name="supplierId"
          defaultValue=""
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        >
          <option value="">—</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
        Materiale
        <select
          name="productId"
          defaultValue=""
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        >
          <option value="">—</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
        Tipo di spesa
        <select
          name="expenseKind"
          value={expenseKind}
          onChange={(e) => setExpenseKind(e.target.value)}
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        >
          <option value="service">Servizio</option>
          <option value="material">Materiale</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
        Data di acquisto
        <input
          type="date"
          name="purchaseDate"
          required
          className="h-11 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
        Importo
        <input
          name="expenseAmount"
          type="number"
          min="0"
          step="0.01"
          required
          className="h-11 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
        Tipo di pagamento
        <select
          name="paymentType"
          value={paymentType}
          onChange={(e) => setPaymentType(e.target.value)}
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        >
          <option value="cash">Contanti</option>
          <option value="electronic">Elettronico</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
        Note
        <textarea
          name="expenseNote"
          rows={3}
          className="rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          placeholder="Dettagli su condizioni di pagamento o numeri documento"
        />
      </label>
    </div>
  );
}
