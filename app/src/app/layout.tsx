import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-zinc-50 text-zinc-900 antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
