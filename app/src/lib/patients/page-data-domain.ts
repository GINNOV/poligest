export type PatientQuoteDraft = {
  id?: string;
  serviceId?: string;
  serviceName?: string;
  serviceDate?: string;
  quantity?: number;
  price?: number;
  total?: number;
  signatureUrl?: string;
  signedAt?: string;
  items?: Array<{
    id?: string;
    dentalRecordId?: string | null;
    serviceId?: string;
    serviceName?: string;
    serviceDate?: string;
    quantity?: number;
    price?: number;
    total?: number;
    saldato?: boolean;
    treated?: boolean;
    tooth?: number;
    createdAt?: string;
  }>;
} | null;

type QuoteDraftScalar = number | string | { toString(): string } | null | undefined;

export type QuoteDraftItemInput = {
  id: string;
  dentalRecordId?: string | null;
  serviceId: string | null;
  serviceName: string | null;
  serviceDate: Date | null;
  quantity: number | null;
  price: QuoteDraftScalar;
  total: QuoteDraftScalar;
  saldato: boolean | null;
  treated?: boolean | null;
  tooth?: number | null;
  createdAt: Date | null;
};

export type QuoteDraftInput = {
  id: string;
  serviceId: string | null;
  serviceName: string | null;
  serviceDate: Date | null;
  quantity: number | null;
  price: QuoteDraftScalar;
  total: QuoteDraftScalar;
  signatureUrl: string | null;
  signedAt: Date | null;
  items?: QuoteDraftItemInput[];
} | null;

export type ParsedPatientNotes = {
  parsedAddress: string;
  parsedCity: string;
  parsedTaxId: string;
  parsedConditions: string[];
  parsedMedications: string;
  parsedExtra: string;
};

function toNumericValue(value: QuoteDraftScalar) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  const asNumber = Number(value.toString());
  return Number.isNaN(asNumber) ? 0 : asNumber;
}

export function parsePatientStructuredNotes(notes: string | null | undefined): ParsedPatientNotes {
  const notesLines = (notes ?? "").split("\n").map((line) => line.trim());
  const addressLine = notesLines.find((line) => line.startsWith("Indirizzo:"));
  const addressPayload = addressLine?.replace("Indirizzo:", "").trim() ?? "";
  const addressSeparatorIndex = addressPayload.lastIndexOf(",");
  const parsedAddressRaw =
    addressSeparatorIndex >= 0 ? addressPayload.slice(0, addressSeparatorIndex).trim() : addressPayload;
  const parsedCityRaw =
    addressSeparatorIndex >= 0 ? addressPayload.slice(addressSeparatorIndex + 1).trim() : "";
  const taxIdLine = notesLines.find((line) => line.startsWith("Codice Fiscale:"));
  const anamnesisLine = notesLines.find((line) => line.startsWith("Anamnesi:"));
  const medicationsLine = notesLines.find((line) => line.startsWith("Farmaci:"));
  const extraLine = notesLines.find(
    (line) => line.startsWith("Note aggiuntive:") || line.startsWith("Note:"),
  );

  return {
    parsedAddress: parsedAddressRaw === "—" ? "" : parsedAddressRaw,
    parsedCity: parsedCityRaw === "—" ? "" : parsedCityRaw,
    parsedTaxId: taxIdLine?.replace("Codice Fiscale:", "").trim() ?? "",
    parsedConditions: anamnesisLine
      ? anamnesisLine
          .replace("Anamnesi:", "")
          .split(",")
          .map((condition) => condition.trim())
          .filter(Boolean)
      : [],
    parsedMedications: medicationsLine?.replace("Farmaci:", "").trim() ?? "",
    parsedExtra: extraLine
      ? extraLine.replace("Note aggiuntive:", "").replace("Note:", "").trim()
      : "",
  };
}

export function serializePatientQuoteDraft(latestQuote: QuoteDraftInput): PatientQuoteDraft {
  if (!latestQuote) {
    return null;
  }

  return {
    id: latestQuote.id,
    serviceId: latestQuote.serviceId ?? undefined,
    serviceName: latestQuote.serviceName ?? undefined,
    serviceDate: latestQuote.serviceDate?.toISOString?.() ?? undefined,
    quantity: latestQuote.quantity ?? undefined,
    price: toNumericValue(latestQuote.price),
    total: toNumericValue(latestQuote.total),
    signatureUrl: latestQuote.signatureUrl ?? undefined,
    signedAt: latestQuote.signedAt?.toISOString?.() ?? undefined,
    items: Array.isArray(latestQuote.items)
      ? latestQuote.items.map((item) => ({
          id: item.id,
          dentalRecordId: item.dentalRecordId ?? undefined,
          serviceId: item.serviceId ?? undefined,
          serviceName: item.serviceName ?? undefined,
          serviceDate: item.serviceDate?.toISOString?.() ?? undefined,
          quantity: item.quantity ?? undefined,
          price: toNumericValue(item.price),
          total: toNumericValue(item.total),
          saldato: Boolean(item.saldato),
          treated: item.treated != null ? Boolean(item.treated) : undefined,
          tooth: item.tooth ?? undefined,
          createdAt: item.createdAt?.toISOString?.() ?? undefined,
        }))
      : undefined,
  };
}
