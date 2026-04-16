/**
 * Core financial logic for the clinic.
 * Centralizes calculations for balances, statuses, and summaries.
 */

/**
 * Calculates the remaining balance (Residuo) for a quote item or total.
 * Logic: Total - Paid - Pagherò (Altro is EXCLUDED from subtraction).
 */
export function calculateRemaining(total: number, paid: number, paghero: number): number {
  return Math.max(0, total - paid - paghero);
}

export type QuoteItemPaymentStatus = "settled" | "partial" | "unpaid" | "in_progress" | "promised_altro";

/**
 * Determines the payment status of a quote item based on priority.
 */
export function getQuoteItemPaymentStatus(
  params: {
    total: number;
    paid: number;
    paghero: number;
    altro: number;
    inProgress: boolean;
  }
): QuoteItemPaymentStatus {
  const { total, paid, paghero, altro, inProgress } = params;
  
  if (inProgress) return "in_progress";
  
  const remaining = calculateRemaining(total, paid, paghero);
  if (remaining < 0.01) return "settled";
  
  if (paid > 0.009) return "partial";
  
  if (altro > 0.009) return "promised_altro";
  
  return "unpaid";
}

export type QuoteItemSummary = {
  id: string;
  serviceName: string;
  tooth?: number | null;
  quantity: number;
  total: number;
  paid: number;
  paghero: number;
  altro: number;
  remaining: number;
  saldato: boolean;
  status: QuoteItemPaymentStatus;
  label: string;
};

/**
 * Summarizes a quote item with all derived fields.
 */
export function summarizeQuoteItem(item: {
  id: string;
  serviceName: string;
  quantity: number;
  total: number;
  paid: number;
  paghero: number;
  altro: number;
  tooth?: number | null;
  inProgress: boolean;
}): QuoteItemSummary {
  const remaining = calculateRemaining(item.total, item.paid, item.paghero);
  const status = getQuoteItemPaymentStatus({
    total: item.total,
    paid: item.paid,
    paghero: item.paghero,
    altro: item.altro,
    inProgress: item.inProgress,
  });

  const formattedRemaining = new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(remaining);

  return {
    ...item,
    remaining,
    status,
    saldato: status === "settled",
    label: `${item.serviceName}${item.tooth ? ` (Dente ${item.tooth})` : ""} · residuo ${formattedRemaining}`,
  };
}
