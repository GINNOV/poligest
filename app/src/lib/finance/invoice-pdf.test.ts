import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { renderStudioInvoicePdf } from "@/lib/finance/invoice-pdf";

describe("renderStudioInvoicePdf", () => {
  it("builds a one-page PDF for the studio invoice", async () => {
    const bytes = await renderStudioInvoicePdf({
      clinicName: "Studio Agovino & Angrisano",
      invoiceNumber: "2026/1",
      issueDate: "29/09/2026",
      patientName: "Rossi Maria",
      patientTaxId: "RSSMRA80A01H501U",
      total: "180.00",
      lines: [
        {
          serviceName: "Apicectomia",
          quantity: 1,
          price: "180.00",
          total: "180.00",
          serviceDate: "14/04/2026",
        },
      ],
    });

    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
  });

  it("keeps a service name that the standard font cannot encode", async () => {
    const bytes = await renderStudioInvoicePdf({
      clinicName: "Studio Agovino & Angrisano",
      invoiceNumber: "2026/2",
      issueDate: "29/09/2026",
      patientName: "Rossi Maria",
      patientTaxId: null,
      total: "600.00",
      lines: [
        {
          serviceName: "👑 PROTESI MOBILE",
          quantity: 1,
          price: "600.00",
          total: "600.00",
          serviceDate: "21/09/2026",
        },
      ],
    });

    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
  });
});
