"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatDateInDisplayTimeZone,
  getBrowserUserDisplayTimeZone,
} from "@/lib/user-display-time-zone";

type PatientOption = { id: string; fullName: string };
type DiaryOption = { id: string; patientId: string; label: string; performedAt: string };
type SupplierOption = { id: string; name: string };
type ProductOption = { id: string; name: string };
type QuoteItemOption = {
  id: string;
  label: string;
  total: number;
  paid: number;
  remaining: number;
  tooth?: number | null;
};
type DoctorOption = { id: string; fullName: string };

type IncomeProps = {
  patients: PatientOption[];
  diaryOptions: DiaryOption[];
};

export function FinanceIncomeFields({ patients, diaryOptions }: IncomeProps) {
  const [patientId, setPatientId] = useState<string>("");
  const [displayTimeZone] = useState(() => getBrowserUserDisplayTimeZone());
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  const patientDiaryEntries = useMemo(() => {
    if (!patientId) return [];
    const entries = diaryOptions.filter((d) => d.patientId === patientId);
    return entries.sort((a, b) => a.label.localeCompare(b.label, "it", { sensitivity: "base" }));
  }, [diaryOptions, patientId]);

  const selectedPatient = patients.find((p) => p.id === patientId);

  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Paziente
        <select
          name="patientId"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          required
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900"
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

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Data di erogazione
        <input
          type="date"
          name="deliveredAt"
          required
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Prestazione erogata (diario clinico)
        <select
          name="deliveredItemId"
          required
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900"
          disabled={!patientId}
          defaultValue=""
        >
          <option value="" disabled>
            {patientId ? "Seleziona una voce dal diario" : "Scegli prima un paziente"}
          </option>
          {patientDiaryEntries.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label} ·{" "}
              {isMounted ? formatDateInDisplayTimeZone(
                new Date(entry.performedAt),
                { dateStyle: "medium" },
                displayTimeZone
              ) : null}
            </option>
          ))}
        </select>
        {selectedPatient && patientDiaryEntries.length === 0 ? (
          <span className="text-xs text-amber-600 dark:text-amber-500">
            Nessuna voce di diario per questo paziente: aggiungi una procedura prima di registrare il pagamento.
          </span>
        ) : (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Lista compilata automaticamente dal diario clinico del paziente.
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        <span className="font-bold text-rose-600 dark:text-rose-500 italic">Importo</span>
        <input
          name="amount"
          type="number"
          min="0"
          step="0.01"
          required
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900"
        />
      </label>

      <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        <input
          type="checkbox"
          name="partialPayment"
          value="1"
          className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900"
        />
        Pagamento parziale
      </label>
    </div>
  );
}

type PatientPaymentFieldsProps = {
  patientId: string;
  quoteId: string;
  quoteItems: QuoteItemOption[];
  diarioUrl?: string;
  doctors: DoctorOption[];
};

export function PatientPaymentFields({
  patientId,
  quoteId,
  quoteItems,
  doctors,
}: PatientPaymentFieldsProps) {
  const [quoteItemId, setQuoteItemId] = useState<string>("");
  const [prevQuoteItems, setPrevQuoteItems] = useState(quoteItems);

  if (quoteItems !== prevQuoteItems) {
    setPrevQuoteItems(quoteItems);
    // If current selected item is no longer in the list (e.g. fully paid and filtered out),
    // or its remaining amount changed and we want to ensure we're still pointing to a valid one.
    if (quoteItemId && !quoteItems.find((item) => item.id === quoteItemId)) {
      setQuoteItemId("");
    }
  }

  const selectedItem = useMemo(
    () => quoteItems.find((item) => item.id === quoteItemId) ?? null,
    [quoteItemId, quoteItems]
  );

  return (
    <div className="space-y-3">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="quoteId" value={quoteId} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200 lg:flex-1">
          Prestazione del preventivo
          <select
            name="quoteItemId"
            value={quoteItemId}
            onChange={(event) => setQuoteItemId(event.target.value)}
            required
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900"
          >
            <option value="" disabled>
              Seleziona una prestazione
            </option>
            {quoteItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        {selectedItem ? (
          <div className="flex h-11 shrink-0 items-center rounded-xl border border-emerald-100 bg-emerald-50 px-4 text-xs font-semibold text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400">
            <div className="flex flex-wrap gap-x-4">
              <span>Totale: € {selectedItem.total.toFixed(2)}</span>
              <span>Incassato: € {selectedItem.paid.toFixed(2)}</span>
              <span className="text-emerald-700 dark:text-emerald-300">
                Residuo: € {selectedItem.remaining.toFixed(2)}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {quoteItemId && (
        <div className="grid gap-3 md:grid-cols-5 animate-in fade-in slide-in-from-top-2 duration-300">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Data incasso
            <input
              type="date"
              name="paidAt"
              required
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Medico
            <select
              name="doctorId"
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900"
              defaultValue=""
            >
              <option value="">(Automatico)</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Metodo
            <select
              name="paymentMethod"
              defaultValue="ELECTRONIC"
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900"
            >
              <option value="CASH">Contanti</option>
              <option value="ELECTRONIC">Elettronico</option>
              <option value="BANK_TRANSFER">Bonifico</option>
              <option value="PAY_LATER" className="text-rose-600 dark:text-rose-400">
                Pagherò
              </option>
              <option value="OTHER">insolvente</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            <span className="font-bold text-rose-600 dark:text-rose-500 italic uppercase tracking-tighter">Importo</span>
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              max={selectedItem ? selectedItem.remaining.toFixed(2) : undefined}
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Nota
            <input
              name="note"
              type="text"
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900"
              placeholder="Es. acconto, saldo finale..."
            />
          </label>
        </div>
      )}
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
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Descrizione
        <input
          name="expenseDescription"
          required
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900"
          placeholder="Es. Acquisto materiali, manutenzione..."
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Fornitore
        <select
          name="supplierId"
          defaultValue=""
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900"
        >
          <option value="">—</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Materiale
        <select
          name="productId"
          defaultValue=""
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900"
        >
          <option value="">—</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Tipo di spesa
        <select
          name="expenseKind"
          value={expenseKind}
          onChange={(e) => setExpenseKind(e.target.value)}
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900"
        >
          <option value="service">Servizio</option>
          <option value="material">Materiale</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Data di acquisto
        <input
          type="date"
          name="purchaseDate"
          required
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Importo
        <input
          name="expenseAmount"
          type="number"
          min="0"
          step="0.01"
          required
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Tipo di pagamento
        <select
          name="paymentType"
          value={paymentType}
          onChange={(e) => setPaymentType(e.target.value)}
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900"
        >
          <option value="cash">Contanti</option>
          <option value="electronic">Elettronico</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Note
        <textarea
          name="expenseNote"
          rows={3}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-emerald-900"
          placeholder="Dettagli su condizioni di pagamento o numeri documento"
        ></textarea>
      </label>
    </div>
  );
}
