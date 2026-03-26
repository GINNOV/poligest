import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { StackProvider, StackTheme } from "@stackframe/stack";
import { stackServerApp } from "@/lib/stack-app";
import { PreventDoubleSubmit } from "@/components/prevent-double-submit";
import { GlobalLoadingOverlay } from "@/components/global-loading-overlay";
import { GlobalToasts } from "@/components/global-toasts";
import { ConfirmBeforeSubmit } from "@/components/confirm-before-submit";
import { CookieBanner } from "@/components/cookie-banner";
import { TooltipProvider } from "@/components/ui/tooltip";

const stackTheme = {
  light: {
    background: "#ffffff",
    foreground: "#0f172a",
    card: "#ffffff",
    cardForeground: "#0f172a",
    popover: "#ffffff",
    popoverForeground: "#0f172a",
    primary: "#047857",
    primaryForeground: "#ffffff",
    secondary: "#ecfdf5",
    secondaryForeground: "#065f46",
    muted: "#f8fafc",
    mutedForeground: "#475569",
    accent: "#d1fae5",
    accentForeground: "#065f46",
    destructive: "#dc2626",
    destructiveForeground: "#ffffff",
    border: "#d1d5db",
    input: "#ffffff",
    ring: "#10b981",
  },
  dark: {
    background: "#0f172a",
    foreground: "#e5eef4",
    card: "#111827",
    cardForeground: "#f8fafc",
    popover: "#111827",
    popoverForeground: "#f8fafc",
    primary: "#34d399",
    primaryForeground: "#052e26",
    secondary: "#1f2937",
    secondaryForeground: "#d1fae5",
    muted: "#18212f",
    mutedForeground: "#94a3b8",
    accent: "#163b33",
    accentForeground: "#d1fae5",
    destructive: "#dc2626",
    destructiveForeground: "#ffffff",
    border: "#334155",
    input: "#0f172a",
    ring: "#34d399",
  },
  radius: "0.75rem",
} as const;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <StackTheme theme={stackTheme}>
      <TooltipProvider>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <StackProvider app={stackServerApp} lang="it-IT">
            {children}
            <GlobalToasts />
            <GlobalLoadingOverlay />
            <PreventDoubleSubmit />
            <ConfirmBeforeSubmit />
            <CookieBanner />
          </StackProvider>
        </NextIntlClientProvider>
      </TooltipProvider>
    </StackTheme>
  );
}
