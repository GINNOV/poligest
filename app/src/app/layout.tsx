import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { StackProvider } from "@stackframe/stack";
import { stackServerApp } from "@/lib/stack-app";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PoliGest Medical",
  description:
    "Gestione clinica centralizzata: agenda, cartelle, magazzino e finanza.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const stackLang =
    locale === "it" ? "it-IT" : undefined; // Stack expects full locale tags

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-zinc-50 text-zinc-900 antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <StackProvider app={stackServerApp} lang={stackLang}>
            {children}
          </StackProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
