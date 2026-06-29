const SERVICE_EMOJI_RULES: Array<{ pattern: RegExp; emoji: string }> = [
  { pattern: /(richiamo|promemoria)/i, emoji: "🔔" },
  { pattern: /(radiograf|panoram|\brx\b)/i, emoji: "📸" },
  { pattern: /(sbianc)/i, emoji: "✨" },
  { pattern: /(impiant)/i, emoji: "🦴" },
  { pattern: /(protes|corona|faccett|ponte)/i, emoji: "👑" },
  { pattern: /(ortodonz|apparecch)/i, emoji: "😁" },
  { pattern: /(estraz|chirurg|asport)/i, emoji: "🩹" },
  { pattern: /(ottur|carie)/i, emoji: "🔧" },
  { pattern: /(endodon|devital)/i, emoji: "🩺" },
  { pattern: /(parodont|gengiv)/i, emoji: "🦷" },
  { pattern: /(igien|pulizia|detartr)/i, emoji: "🪥" },
  { pattern: /(visita|controllo|consul)/i, emoji: "📋" },
  { pattern: /(preventiv|piano)/i, emoji: "📄" },
  { pattern: /(urgenz|emergen)/i, emoji: "🚨" },
];

export const DEFAULT_SERVICE_EMOJI = "🦷";

const EMOJI_PREFIX_PATTERN = /^[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u;

export function stripServiceEmojiPrefix(name: string) {
  return name.replace(EMOJI_PREFIX_PATTERN, "").trim();
}

export function normalizeServiceBaseName(name: string) {
  return stripServiceEmojiPrefix(name)
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("it-IT");
}

export function resolveServiceEmoji(baseName: string) {
  for (const rule of SERVICE_EMOJI_RULES) {
    if (rule.pattern.test(baseName)) {
      return rule.emoji;
    }
  }

  return DEFAULT_SERVICE_EMOJI;
}

export function formatServiceName(raw: string) {
  const base = normalizeServiceBaseName(raw);
  if (!base) return raw.trim();

  const emoji = resolveServiceEmoji(base);
  return `${emoji} ${base}`;
}

export function serviceNamesMatch(left: string, right: string) {
  return normalizeServiceBaseName(left) === normalizeServiceBaseName(right);
}