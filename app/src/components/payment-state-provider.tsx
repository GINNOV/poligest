"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useMemo } from "react";
import { 
  getQuoteItemPaymentStatus, 
  type QuoteItemSummary,
  calculateRemaining
} from "@/lib/finance/domain-logic";

type PaymentContextType = {
  items: QuoteItemSummary[];
  updateItemPrice: (id: string, newPrice: number, newQuantity: number) => void;
  totals: { total: number; paid: number; paghero: number; altro: number; remaining: number };
};

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

export function PaymentStateProvider({
  initialItems,
  initialAltro,
  children,
}: {
  initialItems: QuoteItemSummary[];
  initialAltro: number;
  children: ReactNode;
}) {
  const [items, setItems] = useState(initialItems);

  // Sync with server data if it changes (e.g. after save)
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const updateItemPrice = (id: string, newPrice: number, newQuantity: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newTotal = newPrice * newQuantity;
          const status = getQuoteItemPaymentStatus({
            total: newTotal,
            paid: item.paid,
            paghero: item.paghero,
            altro: item.altro,
            inProgress: item.status === "in_progress",
          });
          const remaining = calculateRemaining(newTotal, item.paid, item.paghero);

          return {
            ...item,
            quantity: newQuantity,
            total: newTotal,
            remaining,
            saldato: status === "settled",
            status,
          };
        }
        return item;
      })
    );
  };

  const totals = useMemo(() => {
    const sums = items.reduce(
      (acc, item) => {
        acc.total += item.total;
        acc.paid += item.paid;
        acc.paghero += item.paghero;
        acc.remaining += item.remaining;
        return acc;
      },
      { total: 0, paid: 0, paghero: 0, remaining: 0 }
    );
    return { ...sums, altro: initialAltro };
  }, [items, initialAltro]);

  return (
    <PaymentContext.Provider value={{ items, updateItemPrice, totals }}>
      {children}
    </PaymentContext.Provider>
  );
}

export function usePaymentState() {
  const context = useContext(PaymentContext);
  if (!context) {
    throw new Error("usePaymentState must be used within a PaymentStateProvider");
  }
  return context;
}
