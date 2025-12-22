export function normalizeItalianPhone(rawPhone: string | null | undefined) {
  const trimmed = (rawPhone ?? "").trim();
  if (!trimmed) return null;

  const compact = trimmed.replace(/[\s()-]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (compact.startsWith("39")) return `+${compact}`;
  return `+39${compact}`;
}
