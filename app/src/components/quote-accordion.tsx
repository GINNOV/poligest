"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ConflictDialog } from "@/components/conflict-dialog";
import { usePaymentState } from "./payment-state-provider";
import { SignatureSection } from "./quote/SignatureSection";
import { QuoteItemRow } from "./quote/QuoteItemRow";
import { QuoteHeader } from "./quote/QuoteHeader";
import {
  formatDateInDisplayTimeZone,
  formatDateInputValueInTimeZone,
  getBrowserUserDisplayTimeZone,
} from "@/lib/user-display-time-zone";

type ServiceOption = {
  id: string;
  name: string;
  costBasis: number;
};

type QuoteDraft = {
  id?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
  serviceDate?: string | null;
  quantity?: number | null;
  price?: number | null;
  total?: number | null;
  signatureUrl?: string | null;
  signedAt?: string | null;
  items?: Array<{
    id?: string | null;
    dentalRecordId?: string | null;
    serviceId?: string | null;
    serviceName?: string | null;
    serviceDate?: string | null;
    quantity?: number | null;
    price?: number | null;
    total?: number | null;
    saldato?: boolean | null;
    treated?: boolean | null;
    tooth?: number | null;
    createdAt?: string | null;
    payments?: Array<{ amount: number }>;
  }>;
};

type SaveState = { savedAt: number };

type Props = {
  patientId: string;
  patientName?: string;
  services: ServiceOption[];
  initialQuote: QuoteDraft | null;
  defaultServiceDate: string;
  printHref?: string | null;
  className?: string;
  onSave: (prevState: SaveState, formData: FormData) => Promise<SaveState>;
};

function getDefaultServiceDate(value: string | null | undefined, displayTimeZone: string) {
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateInputValueInTimeZone(parsed, displayTimeZone);
    }
  }
  return formatDateInputValueInTimeZone(new Date(), displayTimeZone);
}

type QuoteItem = {
  id: string;
  dentalRecordId: string | null;
  serviceId: string;
  serviceDate: string;
  quantity: string;
  price: string;
  treated: boolean;
  tooth: number | null;
  createdAt: string | null;
  payments?: Array<{ amount: number }>;
};

export function QuoteAccordion({
  patientId,
  patientName,
  services,
  initialQuote,
  defaultServiceDate,
  onSave,
  className,
  printHref,
}: Props) {
  const router = useRouter();
  const { updateItemPrice } = usePaymentState();
  const [displayTimeZone, setDisplayTimeZone] = useState("UTC");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setDisplayTimeZone(getBrowserUserDisplayTimeZone());
    setIsMounted(true);
  }, []);

  const sortedServices = useMemo(
    () =>
      [...services].sort((a, b) =>
        a.name.localeCompare(b.name, "it", { sensitivity: "base" })
      ),
    [services]
  );

  const initialItems = useMemo((): QuoteItem[] => {
    if (initialQuote?.items && initialQuote.items.length) {
      return initialQuote.items.map((item) => ({
        id: item.id ?? "",
        dentalRecordId: item.dentalRecordId ?? null,
        serviceId: item.serviceId ?? "",
        serviceDate: getDefaultServiceDate(
          item.serviceDate ?? initialQuote.serviceDate ?? defaultServiceDate,
          displayTimeZone
        ),
        quantity: item.quantity ? String(item.quantity) : "1",
        price: item.price != null ? String(item.price) : "",
        treated: Boolean(item.treated),
        tooth: item.tooth ?? null,
        createdAt: item.createdAt ?? null,
        payments: item.payments,
      }));
    }
    if (initialQuote?.serviceId) {
      return [
        {
          id: "",
          dentalRecordId: null,
          serviceId: initialQuote.serviceId,
          serviceDate: getDefaultServiceDate(initialQuote.serviceDate ?? defaultServiceDate, displayTimeZone),
          quantity: initialQuote.quantity ? String(initialQuote.quantity) : "1",
          price: initialQuote.price != null ? String(initialQuote.price) : "",
          treated: false,
          tooth: null,
          createdAt: null,
          payments: [],
        },
      ];
    }
    return [];
  }, [defaultServiceDate, displayTimeZone, initialQuote]);

  const [items, setItems] = useState<QuoteItem[]>(initialItems);
  const [signatureReady, setSignatureReady] = useState(Boolean(initialQuote?.signatureUrl));
  const [prevInitialQuote, setPrevInitialQuote] = useState(initialQuote);
  const [prevDisplayTimeZone, setPrevDisplayTimeZone] = useState(displayTimeZone);
  const [removeDialog, setRemoveDialog] = useState<{ index: number; type: "warning" | "confirm" } | null>(null);

  const [dirtyVersion, setDirtyVersion] = useState(0);
  const [savedVersion, setSavedVersion] = useState(0);
  const dirtyVersionRef = useRef(0);

  if (JSON.stringify(initialQuote) !== JSON.stringify(prevInitialQuote) || displayTimeZone !== prevDisplayTimeZone) {
    setPrevInitialQuote(initialQuote);
    setPrevDisplayTimeZone(displayTimeZone);
    setItems(initialItems);
    setSignatureReady(Boolean(initialQuote?.signatureUrl));
    setDirtyVersion(0);
    setSavedVersion(0);
  }

  useEffect(() => {
    if (dirtyVersion === 0 && savedVersion === 0) {
      dirtyVersionRef.current = 0;
    }
  }, [dirtyVersion, savedVersion]);

  const [, formAction] = useActionState(onSave, { savedAt: 0 });
  const isDirty = dirtyVersion > savedVersion;
  const markDirty = () =>
    setDirtyVersion((prev) => {
      const next = prev + 1;
      dirtyVersionRef.current = next;
      return next;
    });
  const handleFormAction = async (formData: FormData) => {
    await formAction(formData);
    setSavedVersion(dirtyVersionRef.current);
    router.refresh();
  };

  const updateItem = (index: number, next: Partial<QuoteItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...next } : item)));

    const item = items[index];
    if (item?.id) {
      const mergedItem = { ...item, ...next };
      const q = Number.parseInt(mergedItem.quantity, 10);
      const quantity = Number.isNaN(q) || q <= 0 ? 1 : q;
      const p = Number.parseFloat(String(mergedItem.price).replace(",", "."));
      const price = Number.isNaN(p) ? 0 : p;
      updateItemPrice(mergedItem.id, price, quantity);
    }
    markDirty();
  };

  const addItem = () => {
    const fallbackService = sortedServices[0]?.id ?? "";
    setItems((prev) => [
      ...prev,
      {
        id: "",
        dentalRecordId: null,
        serviceId: fallbackService,
        serviceDate: defaultServiceDate,
        quantity: "1",
        price: fallbackService
          ? String(sortedServices.find((service) => service.id === fallbackService)?.costBasis ?? "")
          : "",
        treated: false,
        tooth: null,
        createdAt: null,
        payments: [],
      },
    ]);
    markDirty();
  };

  const removeItem = (index: number) => {
    const item = items[index];
    if (item.dentalRecordId || item.treated) {
      setRemoveDialog({ index, type: "warning" });
      return;
    }
    setRemoveDialog({ index, type: "confirm" });
  };

  const confirmRemove = (index: number) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
    markDirty();
    setRemoveDialog(null);
  };

  const itemsWithTotals = useMemo(() => {
    return items.map((item) => {
      const quantityValue = Math.max(1, Number.parseInt(item.quantity, 10) || 1);
      const priceValue = Number.parseFloat(String(item.price).replace(",", ".")) || 0;
      const totalValue = quantityValue * priceValue;
      const paidValue = item.payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
      const isSettled = totalValue > 0 && paidValue >= totalValue - 0.009;

      return {
        ...item,
        quantityValue,
        priceValue,
        totalValue,
        paidValue,
        isSettled,
      };
    });
  }, [items]);

  const totalSum = useMemo(
    () => itemsWithTotals.reduce((sum, item) => sum + item.totalValue, 0),
    [itemsWithTotals]
  );

  const itemsJson = useMemo(
    () =>
      JSON.stringify(
        itemsWithTotals.map((item) => ({
          id: item.id || undefined,
          dentalRecordId: item.dentalRecordId,
          serviceId: item.serviceId,
          serviceDate: item.serviceDate,
          quantity: item.quantityValue,
          price: item.priceValue,
          tooth: item.tooth,
        }))
      ),
    [itemsWithTotals]
  );

  const formatItemDate = (value?: string | null) => {
    if (!isMounted || !value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return formatDateInDisplayTimeZone(date, { dateStyle: "short", timeStyle: "short" }, displayTimeZone);
  };

  return (
    <details
      open
      className={clsx(
        "group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm [&_summary::-webkit-details-marker]:hidden",
        className
      )}
    >
      <QuoteHeader
        patientId={patientId}
        initialQuoteId={initialQuote?.id}
        isDirty={isDirty}
        printHref={printHref}
      />
      <form action={handleFormAction} className="space-y-6 p-6">
        <input type="hidden" name="patientId" value={patientId} />
        <input type="hidden" name="quoteId" value={initialQuote?.id ?? ""} />
        <input type="hidden" name="itemsJson" value={itemsJson} readOnly />
        <div className="space-y-4">
          {itemsWithTotals.map((item, index) => (
            <QuoteItemRow
              key={`quote-item-${index}`}
              index={index}
              item={item}
              sortedServices={sortedServices}
              onUpdate={updateItem}
              onRemove={removeItem}
              onAdd={addItem}
              canRemove={items.length > 1}
              formatItemDate={formatItemDate}
            />
          ))}

          <div className="flex justify-start">
            <button
              type="button"
              onClick={addItem}
              className="inline-flex h-10 items-center justify-center rounded-full border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 px-4 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 transition hover:border-emerald-300 hover:bg-emerald-100 dark:hover:border-emerald-800 dark:hover:bg-emerald-900/40"
            >
              + Aggiungi prestazione
            </button>
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-6 text-sm text-zinc-600 dark:text-zinc-400">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p>Nessuna prestazione nel preventivo.</p>
                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-emerald-200 dark:border-emerald-900 px-4 text-sm font-semibold text-emerald-700 dark:text-emerald-500 transition hover:border-emerald-300 dark:hover:border-emerald-800 hover:text-emerald-800 dark:hover:text-emerald-400"
                >
                  Aggiungi prestazione
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end">
          <div className="rounded-full border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-2 text-sm font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
            <span>Totale:</span>
            <span className="text-lg font-mono">€ {totalSum.toFixed(2)}</span>
          </div>
        </div>

        <SignatureSection
          name="quoteSignatureData"
          required
          existingSignatureUrl={initialQuote?.signatureUrl ?? null}
          patientName={patientName}
          onSignatureStateChange={setSignatureReady}
          onDirty={markDirty}
        />

        <div className="flex flex-wrap items-center justify-end gap-3">
          <FormSubmitButton
            disabled={!signatureReady || items.length === 0}
            className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
          >
            Aggiorna contabilità
          </FormSubmitButton>
        </div>
      </form>

      {removeDialog && (
        <ConflictDialog
          message={
            removeDialog.type === "warning"
              ? "Questa prestazione è collegata al diario clinico. Per rimuoverla, elimina la prestazione corrispondente dal diario clinico."
              : "Sei sicuro di voler rimuovere questa prestazione dal preventivo?"
          }
          onClose={() => setRemoveDialog(null)}
          onProceed={removeDialog.type === "confirm" ? () => confirmRemove(removeDialog.index) : undefined}
          proceedLabel="Rimuovi"
          actionLabel="Annulla"
        />
      )}
    </details>
  );
}
