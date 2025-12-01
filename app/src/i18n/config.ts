export const locales = ["it"] as const;
export const defaultLocale = "it";
export type Locale = (typeof locales)[number];
