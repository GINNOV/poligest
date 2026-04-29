export function normalizeItalianPhone(rawPhone: string | null | undefined) {
  const trimmed = (rawPhone ?? "").trim();
  if (!trimmed) return null;

  const compact = trimmed.replace(/[\s()-]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (compact.startsWith("39")) return `+${compact}`;
  return `+39${compact}`;
}

export function formatPhone(phone: string | null | undefined) {
  if (!phone) return "—";
  const normalized = normalizeItalianPhone(phone);
  if (!normalized) return "—";

  // Example +393331234567 -> +39 333 123 4567
  if (normalized.startsWith("+39") && normalized.length === 13) {
    return `+39 ${normalized.slice(3, 6)} ${normalized.slice(6, 9)} ${normalized.slice(9)}`;
  }
  return normalized;
}
