type DateTimeLike = {
  $type?: string;
  value?: unknown;
};

const parseDateValue = (value: unknown): Date | null => {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
