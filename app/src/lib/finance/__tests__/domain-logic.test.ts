import { describe, expect, it } from "vitest";
import { allocateQuotePayments } from "../domain-logic";

describe("allocateQuotePayments", () => {
  const quoteItems = [
    { id: "item-1", serviceName: "Igiene", quantity: 1, total: 100, createdAt: new Date("2026-04-01") },
    { id: "item-2", serviceName: "Otturazione", quantity: 1, total: 200, createdAt: new Date("2026-04-02") },
  ];

  it("partially applies a quote downpayment to the oldest item", () => {
    const result = allocateQuotePayments({
      items: quoteItems,
      payments: [
        {
          id: "payment-1",
          quoteItemId: null,
          amount: 40,
          method: "ELECTRONIC",
          kind: "DOWNPAYMENT",
        },
      ],
    });

    expect(result.items.map((item) => ({
      id: item.id,
      downpaymentAllocated: item.downpaymentAllocated,
      paid: item.paid,
      remaining: item.remaining,
      saldato: item.saldato,
    }))).toEqual([
      { id: "item-1", downpaymentAllocated: 40, paid: 40, remaining: 60, saldato: false },
      { id: "item-2", downpaymentAllocated: 0, paid: 0, remaining: 200, saldato: false },
    ]);
    expect(result.downpaymentCredit).toBe(40);
    expect(result.remaining).toBe(260);
  });

  it("settles older items before partially applying credit to later items", () => {
    const result = allocateQuotePayments({
      items: quoteItems,
      payments: [
        {
          id: "payment-1",
          quoteItemId: null,
          amount: 150,
          method: "BANK_TRANSFER",
          kind: "DOWNPAYMENT",
        },
      ],
    });

    expect(result.items.map((item) => ({
      id: item.id,
      downpaymentAllocated: item.downpaymentAllocated,
      paid: item.paid,
      remaining: item.remaining,
      saldato: item.saldato,
    }))).toEqual([
      { id: "item-1", downpaymentAllocated: 100, paid: 100, remaining: 0, saldato: true },
      { id: "item-2", downpaymentAllocated: 50, paid: 50, remaining: 150, saldato: false },
    ]);
  });

  it("applies item-linked payments before quote-level downpayment credit", () => {
    const result = allocateQuotePayments({
      items: quoteItems,
      payments: [
        {
          id: "payment-1",
          quoteItemId: "item-1",
          amount: 70,
          method: "CASH",
          kind: "STANDARD",
        },
        {
          id: "payment-2",
          quoteItemId: null,
          amount: 50,
          method: "ELECTRONIC",
          kind: "DOWNPAYMENT",
        },
      ],
    });

    expect(result.items[0]).toMatchObject({
      paidDirect: 70,
      downpaymentAllocated: 30,
      paid: 100,
      remaining: 0,
      saldato: true,
    });
    expect(result.items[1]).toMatchObject({
      paidDirect: 0,
      downpaymentAllocated: 20,
      paid: 20,
      remaining: 180,
      saldato: false,
    });
  });

  it("keeps pay-later and insolvente behavior separate from actual-money downpayments", () => {
    const result = allocateQuotePayments({
      items: quoteItems,
      payments: [
        {
          id: "payment-1",
          quoteItemId: "item-1",
          amount: 20,
          method: "PAY_LATER",
          kind: "STANDARD",
        },
        {
          id: "payment-2",
          quoteItemId: "item-1",
          amount: 30,
          method: "OTHER",
          kind: "STANDARD",
        },
        {
          id: "payment-3",
          quoteItemId: null,
          amount: 40,
          method: "OTHER",
          kind: "DOWNPAYMENT",
        },
      ],
    });

    expect(result.items[0]).toMatchObject({
      paid: 0,
      paghero: 20,
      altro: 30,
      downpaymentAllocated: 0,
      remaining: 80,
      status: "promised_altro",
    });
    expect(result.totals).toMatchObject({
      paid: 0,
      paghero: 20,
      altro: 70,
      downpaymentCredit: 0,
    });
  });
});
