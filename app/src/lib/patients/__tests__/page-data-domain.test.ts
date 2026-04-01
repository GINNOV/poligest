import { describe, expect, it } from "vitest";
import {
  parsePatientStructuredNotes,
  serializePatientQuoteDraft,
} from "@/lib/patients/page-data-domain";

describe("patient page-data domain", () => {
  it("parses structured patient notes into contact and anamnesis fields", () => {
    const parsed = parsePatientStructuredNotes(
      [
        "Indirizzo: Via Roma 12, Milano",
        "Codice Fiscale: RSSMRA80A01H501U",
        "Anamnesi: Diabete, Ipertensione",
        "Farmaci: Tachipirina",
        "Note aggiuntive: Paziente ansioso",
      ].join("\n"),
    );

    expect(parsed).toEqual({
      parsedAddress: "Via Roma 12",
      parsedCity: "Milano",
      parsedTaxId: "RSSMRA80A01H501U",
      parsedConditions: ["Diabete", "Ipertensione"],
      parsedMedications: "Tachipirina",
      parsedExtra: "Paziente ansioso",
    });
  });

  it("handles placeholder address values and legacy note labels", () => {
    const parsed = parsePatientStructuredNotes(
      ["Indirizzo: —", "Note: Promemoria richiamo"].join("\n"),
    );

    expect(parsed.parsedAddress).toBe("");
    expect(parsed.parsedCity).toBe("");
    expect(parsed.parsedExtra).toBe("Promemoria richiamo");
  });

  it("serializes quote drafts with decimal-like values and nested items", () => {
    const draft = serializePatientQuoteDraft({
      id: "quote-1",
      serviceId: "srv-1",
      serviceName: "Igiene",
      quantity: 2,
      price: { toString: () => "99.50" },
      total: "199",
      signatureUrl: "https://example.test/signature.png",
      signedAt: new Date("2026-03-25T10:00:00.000Z"),
      items: [
        {
          id: "item-1",
          serviceId: "srv-1",
          serviceName: "Igiene",
          quantity: 2,
          price: "99.50",
          total: { toString: () => "199" },
          saldato: null,
          createdAt: new Date("2026-03-25T10:05:00.000Z"),
        },
      ],
    });

    expect(draft).toEqual({
      id: "quote-1",
      serviceId: "srv-1",
      serviceName: "Igiene",
      quantity: 2,
      price: 99.5,
      total: 199,
      signatureUrl: "https://example.test/signature.png",
      signedAt: "2026-03-25T10:00:00.000Z",
      items: [
        {
          id: "item-1",
          serviceId: "srv-1",
          serviceName: "Igiene",
          quantity: 2,
          price: 99.5,
          total: 199,
          saldato: false,
          createdAt: "2026-03-25T10:05:00.000Z",
        },
      ],
    });
  });

  it("returns null when no quote is available", () => {
    expect(serializePatientQuoteDraft(null)).toBeNull();
  });
});
