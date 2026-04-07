import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { StackProvider } from "@stackframe/stack";
import { stackServerApp } from "@/lib/stack-app";
import { PreventDoubleSubmit } from "@/components/prevent-double-submit";
import { GlobalLoadingOverlay } from "@/components/global-loading-overlay";
import { GlobalToasts } from "@/components/global-toasts";
import { ConfirmBeforeSubmit } from "@/components/confirm-before-submit";
import { CookieBanner } from "@/components/cookie-banner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StackConsoleNoiseFilter } from "@/components/stack-console-noise-filter";
import { CrashContextTracker } from "@/components/crash-context-tracker";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <TooltipProvider>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <StackProvider app={stackServerApp} lang="it-IT">
          {children}
          <GlobalToasts />
          <GlobalLoadingOverlay />
          <PreventDoubleSubmit />
          <ConfirmBeforeSubmit />
          <CookieBanner />
          <StackConsoleNoiseFilter />
          <CrashContextTracker />
        </StackProvider>
      </NextIntlClientProvider>
    </TooltipProvider>
  );
}
