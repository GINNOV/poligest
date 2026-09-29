export const DEFAULT_INVOICE_EMAIL_BODY = `Ciao {{patientName}},

la fattura {{invoiceNumber}} del {{invoiceDate}} è pronta.

{{invoiceLines}}

Totale: {{invoiceTotal}}

Grazie,
{{clinicName}}`;

export type InvoiceSourceStatus = "ISSUED" | "VOID";

export type QuoteForInvoice = {
  id: string;
  serviceName: string;
  serviceDate: Date;
  quantity: number;
  price: number;
  total: number;
  items: Array<{
    id: string;
    serviceName: string;
    serviceDate: Date;
    quantity: number;
    price: number;
    total: number;
  }>;
};

export type InvoiceSourceRef = {
  quoteId: string;
  quoteItemId: string | null;
  status: InvoiceSourceStatus;
};

export type BillableInvoiceLine = {
  quoteId: string;
  quoteItemId: string | null;
  serviceName: string;
  serviceDate: Date;
  quantity: number;
  price: number;
  total: number;
};

export function formatInvoiceNumber(year: number, number: number) {
  return `${year}/${number}`;
}

export function invoiceYear(issuedAt: Date, timeZone: string) {
  const year = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
  }).format(issuedAt);
  return Number(year);
}

export function nextInvoiceNumber(usedNumbers: number[]) {
  if (usedNumbers.length === 0) return 1;
  return Math.max(...usedNumbers) + 1;
}

export function invoiceSourceKey(quoteId: string, quoteItemId: string | null) {
  return `${quoteId}:${quoteItemId ?? ""}`;
}

export function parseInvoiceSourceKey(value: string) {
  const separator = value.indexOf(":");
  if (separator <= 0) return null;
  const quoteId = value.slice(0, separator);
  const quoteItemId = value.slice(separator + 1);
  if (!quoteId) return null;
  return { quoteId, quoteItemId: quoteItemId || null };
}

export function snapshotPatientName(lastName: string, firstName: string) {
  return `${lastName} ${firstName}`.trim();
}

function moneyCents(value: number) {
  return Math.round(value * 100);
}

function fromCents(cents: number) {
  return cents / 100;
}

export function billableLines(quotes: QuoteForInvoice[], sources: InvoiceSourceRef[]): BillableInvoiceLine[] {
  const blocked = new Set(
    sources
      .filter((source) => source.status === "ISSUED")
      .map((source) => invoiceSourceKey(source.quoteId, source.quoteItemId)),
  );

  const lines: BillableInvoiceLine[] = [];
  for (const quote of quotes) {
    if (quote.items.length > 0) {
      for (const item of quote.items) {
        if (blocked.has(invoiceSourceKey(quote.id, item.id))) continue;
        lines.push({
          quoteId: quote.id,
          quoteItemId: item.id,
          serviceName: item.serviceName,
          serviceDate: item.serviceDate,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        });
      }
      continue;
    }

    if (blocked.has(invoiceSourceKey(quote.id, null))) continue;
    lines.push({
      quoteId: quote.id,
      quoteItemId: null,
      serviceName: quote.serviceName,
      serviceDate: quote.serviceDate,
      quantity: quote.quantity,
      price: quote.price,
      total: quote.total,
    });
  }
  return lines;
}

export function selectInvoiceLines(available: BillableInvoiceLine[], selectedKeys: string[]) {
  if (selectedKeys.length === 0) {
    return { ok: false as const, message: "Seleziona almeno una riga." };
  }

  const byKey = new Map(available.map((line) => [invoiceSourceKey(line.quoteId, line.quoteItemId), line]));
  const lines: BillableInvoiceLine[] = [];
  for (const key of selectedKeys) {
    const line = byKey.get(key);
    if (!line || lines.includes(line)) {
      return {
        ok: false as const,
        message: "Alcune righe non sono più disponibili. Aggiorna la pagina.",
      };
    }
    lines.push(line);
  }

  const total = fromCents(lines.reduce((sum, line) => sum + moneyCents(line.total), 0));
  return { ok: true as const, lines, total };
}

export function formatInvoiceLines(
  lines: Array<{ serviceName: string; quantity: number; total: number }>,
) {
  return lines
    .map((line) => `${line.serviceName} × ${line.quantity} ${line.total.toFixed(2)}`)
    .join("\n");
}

export function resolveInvoiceEmailBody(storedBody: string) {
  if (storedBody.includes("{{invoiceLines}}")) return null;
  return DEFAULT_INVOICE_EMAIL_BODY;
}
