export const PAPER_CONSENT_NOTE =
  "ATTENZIONE: Firma acquisita su supporto cartaceo per i moduli obbligatori.";

export function withPaperConsentNote(
  notes: string | null | undefined,
  enabled: boolean,
): string | null {
  const lines = (notes ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const withoutNote = lines.filter((line) => line !== PAPER_CONSENT_NOTE);
  if (!enabled) {
    return withoutNote.join("\n") || null;
  }
  return [...withoutNote, PAPER_CONSENT_NOTE].join("\n");
}