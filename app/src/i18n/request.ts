import { getRequestConfig } from "next-intl/server";
import { defaultLocale, locales } from "./config";

export default getRequestConfig(async ({ locale }) => {
  const localeToLoad: (typeof locales)[number] =
    locale && locales.includes(locale as (typeof locales)[number])
      ? (locale as (typeof locales)[number])
      : defaultLocale;

  return {
    locale: localeToLoad,
    messages: (await import(`../messages/${localeToLoad}.json`)).default,
  };
});
