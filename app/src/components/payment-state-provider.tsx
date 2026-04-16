"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useMemo } from "react";

type QuoteItemSummary = {
  id: string;
  serviceName: string;
  tooth?: number | null;
  quantity: number;
  total: number;
  paid: number;
  remaining: number;
  saldato: boolean;
  status: "settled" | "partial" | "unpaid" | "in_progress";
  label: string;
};

type PaymentContextType = {
  items: QuoteItemSummary[];
  updateItemPrice: (id: string, newPrice: number, newQuantity: number) => void;
  totals: { total: number; paid: number; remaining: number };
};

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

export function PaymentStateProvider({
  initialItems,
  children,
}: {
  initialItems: QuoteItemSummary[];
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
          const newRemaining = Math.max(newTotal - item.paid, 0);
          const newSaldato = newRemaining < 0.01;
          const newStatus = item.status === "in_progress" 
            ? "in_progress" 
            : newSaldato 
              ? "settled" 
              : item.paid > 0.009 
                ? "partial" 
                : "unpaid";

          return {
            ...item,
            quantity: newQuantity,
            total: newTotal,
            remaining: newRemaining,
            saldato: newSaldato,
            status: newStatus,
          };
        }
        return item;
      })
    );
  };

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.total += item.total;
        acc.paid += item.paid;
        acc.remaining += item.remaining;
        return acc;
      },
      { total: 0, paid: 0, remaining: 0 }
    );
  }, [items]);

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
