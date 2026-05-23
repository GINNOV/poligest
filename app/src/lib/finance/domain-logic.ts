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
export type FinancePaymentMethod = "CASH" | "ELECTRONIC" | "BANK_TRANSFER" | "PAY_LATER" | "OTHER";
export type FinancePaymentKind = "STANDARD" | "DOWNPAYMENT";

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
  paidDirect: number;
  downpaymentAllocated: number;
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
  paidDirect?: number;
  downpaymentAllocated?: number;
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
    paidDirect: item.paidDirect ?? item.paid,
    downpaymentAllocated: item.downpaymentAllocated ?? 0,
    remaining,
    status,
    saldato: status === "settled",
    label: `${item.serviceName}${item.tooth ? ` (Dente ${item.tooth})` : ""} · residuo ${formattedRemaining}`,
  };
}

type AllocatableQuoteItem = {
  id: string;
  serviceName: string;
  quantity: number;
  total: number;
  createdAt?: Date | string | null;
  tooth?: number | null;
  inProgress?: boolean;
};

type AllocatablePayment = {
  id?: string;
  quoteItemId: string | null;
  amount: number;
  method: FinancePaymentMethod;
  kind?: FinancePaymentKind | string | null;
};

export type AllocatedQuoteItemSummary = QuoteItemSummary & {
  paidDirect: number;
  downpaymentAllocated: number;
};

export function isActualMoneyPayment(method: FinancePaymentMethod): boolean {
  return method !== "PAY_LATER" && method !== "OTHER";
}

export function allocateQuotePayments({
  items,
  payments,
}: {
  items: AllocatableQuoteItem[];
  payments: AllocatablePayment[];
}): {
  items: AllocatedQuoteItemSummary[];
  totals: {
    total: number;
    paid: number;
    paidDirect: number;
    downpaymentCredit: number;
    paghero: number;
    altro: number;
    remaining: number;
  };
  downpaymentCredit: number;
  remaining: number;
} {
  const sortedItems = [...items].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (aTime !== bTime) return aTime - bTime;
    return a.id.localeCompare(b.id);
  });

  const itemSummaries = sortedItems.map((item) => {
    const itemPayments = payments.filter((payment) => payment.quoteItemId === item.id);
    const paidDirect = itemPayments.reduce(
      (sum, payment) => isActualMoneyPayment(payment.method) ? sum + payment.amount : sum,
      0
    );
    const paghero = itemPayments.reduce(
      (sum, payment) => payment.method === "PAY_LATER" ? sum + payment.amount : sum,
      0
    );
    const altro = itemPayments.reduce(
      (sum, payment) => payment.method === "OTHER" ? sum + payment.amount : sum,
      0
    );

    return {
      item,
      paidDirect,
      paghero,
      altro,
      downpaymentAllocated: 0,
    };
  });

  let remainingDownpaymentCredit = payments.reduce((sum, payment) => {
    if (payment.quoteItemId !== null) return sum;
    if (payment.kind !== "DOWNPAYMENT") return sum;
    if (!isActualMoneyPayment(payment.method)) return sum;
    return sum + payment.amount;
  }, 0);
  const downpaymentCredit = remainingDownpaymentCredit;

  for (const summary of itemSummaries) {
    if (remainingDownpaymentCredit <= 0.009) break;
    const itemResidualBeforeDownpayment = calculateRemaining(
      summary.item.total,
      summary.paidDirect,
      summary.paghero
    );
    const allocated = Math.min(itemResidualBeforeDownpayment, remainingDownpaymentCredit);
    summary.downpaymentAllocated = allocated;
    remainingDownpaymentCredit -= allocated;
  }

  const allocatedItems = itemSummaries.map((summary) => {
    const paid = summary.paidDirect + summary.downpaymentAllocated;
    return summarizeQuoteItem({
      id: summary.item.id,
      serviceName: summary.item.serviceName,
      tooth: summary.item.tooth,
      quantity: summary.item.quantity,
      total: summary.item.total,
      paidDirect: summary.paidDirect,
      downpaymentAllocated: summary.downpaymentAllocated,
      paid,
      paghero: summary.paghero,
      altro: summary.altro,
      inProgress: Boolean(summary.item.inProgress),
    });
  });

  const itemLinkedActualPaid = payments.reduce(
    (sum, payment) => payment.quoteItemId && isActualMoneyPayment(payment.method) ? sum + payment.amount : sum,
    0
  );
  const quoteLevelOther = payments.reduce(
    (sum, payment) => payment.quoteItemId === null && payment.method === "OTHER" ? sum + payment.amount : sum,
    0
  );
  const quoteLevelPayLater = payments.reduce(
    (sum, payment) => payment.quoteItemId === null && payment.method === "PAY_LATER" ? sum + payment.amount : sum,
    0
  );
  const total = allocatedItems.reduce((sum, item) => sum + item.total, 0);
  const paid = allocatedItems.reduce((sum, item) => sum + item.paid, 0);
  const paghero = allocatedItems.reduce((sum, item) => sum + item.paghero, 0) + quoteLevelPayLater;
  const altro = allocatedItems.reduce((sum, item) => sum + item.altro, 0) + quoteLevelOther;
  const remaining = allocatedItems.reduce((sum, item) => sum + item.remaining, 0);

  return {
    items: allocatedItems,
    totals: {
      total,
      paid,
      paidDirect: itemLinkedActualPaid,
      downpaymentCredit,
      paghero,
      altro,
      remaining,
    },
    downpaymentCredit,
    remaining,
  };
}
