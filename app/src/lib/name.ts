const LOWERCASE_PARTICLES = new Set([
  "da",
  "de",
  "dei",
  "degli",
  "della",
  "delle",
  "del",
  "di",
  "e",
  "il",
  "la",
  "le",
  "lo",
  "gli",
  "van",
  "von",
]);

function capitalizeWord(value: string) {
  if (!value) return value;
  const lower = value.toLocaleLowerCase("it");
  return lower.charAt(0).toLocaleUpperCase("it") + lower.slice(1);
}

function normalizeSegment(segment: string, allowLowercase: boolean) {
  if (!segment) return segment;
  if (segment.includes("'")) {
    return segment
      .split("'")
      .map((part) => (part ? capitalizeWord(part) : part))
      .join("'");
  }
  if (allowLowercase && LOWERCASE_PARTICLES.has(segment)) return segment;
  return capitalizeWord(segment);
}

function normalizeWord(word: string, isFirstWord: boolean) {
  const lower = word.toLocaleLowerCase("it");
  const parts = lower.split("-");
  return parts
    .map((part, index) => normalizeSegment(part, !isFirstWord && index === 0))
    .join("-");
}

export function normalizePersonName(raw: string | null | undefined) {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const words = trimmed.split(/\s+/);
  return words.map((word, index) => normalizeWord(word, index === 0)).join(" ");
}
