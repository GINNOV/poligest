import { describe, expect, it } from "vitest";
import {
  billableLines,
  formatInvoiceLines,
  invoicePdfFilename,
  invoiceSendConfirmMessage,
  formatInvoiceNumber,
  invoiceYear,
  nextInvoiceNumber,
  resolveInvoiceEmailBody,
  selectInvoiceLines,
  type QuoteForInvoice,
} from "@/lib/finance/invoices";

const headerQuote: QuoteForInvoice = {
  id: "quote-header",
  serviceName: "Visita",
  serviceDate: new Date("2026-03-01T10:00:00.000Z"),
  quantity: 1,
  price: 80,
  total: 80,
  items: [],
};

const itemQuote: QuoteForInvoice = {
  id: "quote-items",
  serviceName: "Piano",
  serviceDate: new Date("2026-03-02T10:00:00.000Z"),
  quantity: 1,
  price: 200,
  total: 200,
  items: [
    {
      id: "item-a",
      serviceName: "Igiene",
      serviceDate: new Date("2026-03-02T10:00:00.000Z"),
      quantity: 1,
      price: 10.1,
      total: 10.1,
    },
    {
      id: "item-b",
      serviceName: "Otturazione",
      serviceDate: new Date("2026-03-03T10:00:00.000Z"),
      quantity: 2,
      price: 10.1,
      total: 20.2,
    },
  ],
};

describe("studio invoices", () => {
  it("formats the visible number without padding", () => {
    expect(formatInvoiceNumber(2026, 1)).toBe("2026/1");
  });

  it("continues the year sequence through voided numbers and restarts at 1", () => {
    expect(nextInvoiceNumber([1, 2])).toBe(3);
    expect(nextInvoiceNumber([])).toBe(1);
  });

  it("takes the year from the practice timezone across New Year", () => {
    expect(invoiceYear(new Date("2025-12-31T23:30:00.000Z"), "Europe/Rome")).toBe(2026);
    expect(invoiceYear(new Date("2025-12-31T22:30:00.000Z"), "Europe/Rome")).toBe(2025);
  });

  it("exposes quote items and hides the header, or one header line when there are no items", () => {
    const lines = billableLines([itemQuote, headerQuote], []);
    expect(lines.map((line) => line.serviceName)).toEqual(["Igiene", "Otturazione", "Visita"]);
    expect(lines.find((line) => line.quoteItemId === null)?.quoteId).toBe("quote-header");
  });

  it("blocks a source on an issued invoice and frees a source that is only on a voided invoice", () => {
    const lines = billableLines([itemQuote, headerQuote], [
      { quoteId: "quote-items", quoteItemId: "item-a", status: "ISSUED" },
      { quoteId: "quote-header", quoteItemId: null, status: "VOID" },
      { quoteId: "quote-items", quoteItemId: "item-b", status: "VOID" },
    ]);
    expect(lines.map((line) => line.serviceName)).toEqual(["Otturazione", "Visita"]);
  });

  it("keeps a previously invoiced header and still bills items added later", () => {
    const lines = billableLines([itemQuote], [
      { quoteId: "quote-items", quoteItemId: null, status: "ISSUED" },
    ]);
    expect(lines.map((line) => line.quoteItemId)).toEqual(["item-a", "item-b"]);
  });

  it("sums the selected line totals", () => {
    const available = billableLines([itemQuote], []);
    const selected = selectInvoiceLines(available, ["quote-items:item-a", "quote-items:item-b"]);
    expect(selected.ok).toBe(true);
    if (selected.ok) expect(selected.total).toBe(30.3);
  });

  it("rejects an empty selection", () => {
    const selected = selectInvoiceLines(billableLines([headerQuote], []), []);
    expect(selected).toEqual({ ok: false, message: "Seleziona almeno una riga." });
  });

  it("writes one plain-text line per service and keeps a rewritten template body", () => {
    expect(
      formatInvoiceLines([{ serviceName: "Igiene", quantity: 2, total: 80 }]),
    ).toBe("Igiene × 2 80.00");
    expect(resolveInvoiceEmailBody("Ciao {{invoiceLines}}")).toBeNull();
    expect(resolveInvoiceEmailBody("La tua fattura è pronta.")).toContain("{{invoiceLines}}");
  });

  it("names the invoice, the patient, and the address in the send confirmation", () => {
    expect(invoicePdfFilename("2026/1")).toBe("Fattura-2026-1.pdf");
    expect(invoiceSendConfirmMessage("2026/1", "Rossi Maria", "maria@example.com")).toBe(
      "Confermi di inviare la fattura 2026/1 a Rossi Maria all'indirizzo maria@example.com? La fattura è allegata in PDF.",
    );
  });
});
