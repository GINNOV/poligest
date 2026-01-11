import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { StackProvider, StackTheme } from "@stackframe/stack";
import { stackServerApp } from "@/lib/stack-app";
import "../globals.css";
import { PreventDoubleSubmit } from "@/components/prevent-double-submit";
import { GlobalLoadingOverlay } from "@/components/global-loading-overlay";
import { GlobalToasts } from "@/components/global-toasts";
import { ConfirmBeforeSubmit } from "@/components/confirm-before-submit";
import { CookieBanner } from "@/components/cookie-banner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SORRIDI",
  description:
    "Gestione clinica centralizzata: agenda, cartelle, magazzino e finanza.",
  manifest: "/favicon/site.webmanifest",
  icons: {
    icon: "/favicon/favicon.ico",
    shortcut: "/favicon/favicon.ico",
    apple: "/favicon/apple-touch-icon.png",
    other: [
      { rel: "icon", url: "/favicon/favicon-96x96.png", type: "image/png", sizes: "96x96" },
      { rel: "icon", url: "/favicon/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", url: "/favicon/web-app-manifest-192x192.png", type: "image/png", sizes: "192x192" },
      { rel: "icon", url: "/favicon/web-app-manifest-512x512.png", type: "image/png", sizes: "512x512" },
    ],
  },
};

import { TooltipProvider } from "@/components/ui/tooltip";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-zinc-50 text-zinc-900 antialiased`}
      >
        <StackTheme>
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
      </body>
    </html>
  );
}
