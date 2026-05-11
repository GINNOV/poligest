type DateTimeLike = {
  $type?: string;
  value?: unknown;
};

export const isValidDate = (value: Date | null | undefined): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

const parseDateValue = (value: unknown): Date | null => {
  if (typeof value !== "string") return null;
  if (/^[+-]?\d{5,}-/.test(value)) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const hasDateInputValue = (value: FormDataEntryValue | null) => {
  if (!value) return false;
  if (typeof value === "string") return Boolean(value.trim());
  return false;
};

export const parseOptionalDate = (value: FormDataEntryValue | null): Date | null => {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("{") && trimmed.includes("\"$type\"")) {
      try {
        const parsed = JSON.parse(trimmed) as DateTimeLike;
        if (parsed?.$type === "DateTime") {
          return parseDateValue(parsed.value);
        }
      } catch {
        return null;
      }
    }
    return parseDateValue(trimmed);
  }

  const parsed = value as DateTimeLike;
  if (parsed?.$type === "DateTime") {
    return parseDateValue(parsed.value);
  }
  return null;
};

export const parseOptionalBirthDate = (
  value: FormDataEntryValue | null,
  today = new Date(),
): Date | null => {
  const parsed = parseOptionalDate(value);
  if (!parsed) {
    if (hasDateInputValue(value)) {
      throw new Error("Data di nascita non valida.");
    }
    return null;
  }

  const birthDateKey = parsed.toISOString().slice(0, 10);
  const todayKey = today.toISOString().slice(0, 10);
  if (birthDateKey > todayKey) {
    throw new Error("La data di nascita non può essere futura.");
  }

  return parsed;
};

export const formatOptionalDateInputValue = (value: Date | string | null | undefined): string => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!isValidDate(date)) return "";
  return date.toISOString().split("T")[0] ?? "";
};
