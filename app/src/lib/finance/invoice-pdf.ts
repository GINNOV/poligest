import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type StudioInvoicePdfLine = {
  serviceName: string;
  quantity: number;
  price: string;
  total: string;
  serviceDate: string;
};

export type StudioInvoicePdfInput = {
  clinicName: string;
  invoiceNumber: string;
  issueDate: string;
  patientName: string;
  patientTaxId: string | null;
  lines: StudioInvoicePdfLine[];
  total: string;
  logoPng?: Uint8Array | null;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const FOOTER = "Documento di studio. Non sostituisce la fattura elettronica.";

function pdfText(font: PDFFont, value: string) {
  let result = "";
  for (const char of value) {
    try {
      font.encodeText(char);
      result += char;
    } catch {
      result += " ";
    }
  }
  return result.replace(/ {2,}/g, " ").trim();
}

function wrap(font: PDFFont, value: string, size: number, maxWidth: number) {
  const words = pdfText(font, value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

export async function renderStudioInvoicePdf(input: StudioInvoicePdfInput) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.09, 0.09, 0.11);
  const muted = rgb(0.4, 0.4, 0.43);
  const lineColor = rgb(0.86, 0.86, 0.88);
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const draw = (target: PDFPage, text: string, x: number, size: number, font: PDFFont, color = ink) => {
    target.drawText(pdfText(font, text), { x, y, size, font, color });
  };

  if (input.logoPng) {
    try {
      const logo = await doc.embedPng(input.logoPng);
      const height = 36;
      const width = (logo.width / logo.height) * height;
      page.drawImage(logo, { x: MARGIN, y: y - height, width, height });
      y -= height + 18;
    } catch {
      y -= 4;
    }
  }

  draw(page, "FATTURA", MARGIN, 9, bold, rgb(0.02, 0.47, 0.34));
  y -= 18;
  draw(page, input.clinicName, MARGIN, 16, bold);
  y -= 28;
  draw(page, `Numero ${input.invoiceNumber}`, MARGIN, 11, regular);
  y -= 16;
  draw(page, `Data ${input.issueDate}`, MARGIN, 11, regular);
  y -= 22;
  draw(page, "Paziente", MARGIN, 9, bold, muted);
  y -= 16;
  draw(page, input.patientName, MARGIN, 12, bold);
  y -= 16;
  if (input.patientTaxId?.trim()) {
    draw(page, `Codice fiscale ${input.patientTaxId.trim()}`, MARGIN, 10, regular, muted);
    y -= 16;
  }
  y -= 10;

  const columns = [
    { label: "Prestazione", x: MARGIN, width: 230, align: "left" as const },
    { label: "Quantità", x: 290, width: 50, align: "right" as const },
    { label: "Prezzo", x: 350, width: 55, align: "right" as const },
    { label: "Totale", x: 415, width: 55, align: "right" as const },
    { label: "Data", x: 478, width: 69, align: "right" as const },
  ];

  const drawHeader = () => {
    for (const column of columns) {
      const label = pdfText(bold, column.label);
      const width = bold.widthOfTextAtSize(label, 8);
      const x = column.align === "right" ? column.x + column.width - width : column.x;
      page.drawText(label, { x, y, size: 8, font: bold, color: muted });
    }
    y -= 8;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.6,
      color: lineColor,
    });
    y -= 16;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed >= MARGIN + 28) return;
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    drawHeader();
  };

  drawHeader();

  for (const line of input.lines) {
    const nameLines = wrap(regular, line.serviceName, 10, columns[0].width);
    const rowHeight = Math.max(16, nameLines.length * 13);
    ensureSpace(rowHeight + 8);
    nameLines.forEach((nameLine, index) => {
      page.drawText(nameLine, { x: MARGIN, y: y - index * 13, size: 10, font: regular, color: ink });
    });
    const values = [String(line.quantity), line.price, line.total, line.serviceDate];
    values.forEach((value, index) => {
      const column = columns[index + 1];
      const safe = pdfText(regular, value);
      const width = regular.widthOfTextAtSize(safe, 10);
      page.drawText(safe, {
        x: column.x + column.width - width,
        y,
        size: 10,
        font: regular,
        color: ink,
      });
    });
    y -= rowHeight;
  }

  ensureSpace(36);
  y -= 6;
  page.drawLine({
    start: { x: MARGIN, y: y + 12 },
    end: { x: PAGE_WIDTH - MARGIN, y: y + 12 },
    thickness: 0.6,
    color: lineColor,
  });
  const totalLabel = pdfText(bold, `Totale ${input.total}`);
  const totalWidth = bold.widthOfTextAtSize(totalLabel, 12);
  page.drawText(totalLabel, {
    x: PAGE_WIDTH - MARGIN - totalWidth,
    y,
    size: 12,
    font: bold,
    color: ink,
  });
  y -= 28;
  ensureSpace(20);
  page.drawText(pdfText(regular, FOOTER), { x: MARGIN, y, size: 8, font: regular, color: muted });

  return doc.save();
}
