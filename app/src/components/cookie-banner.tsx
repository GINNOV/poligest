"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const COOKIE_KEY = "cookie_consent";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type ConsentChoice = "all" | "necessary";

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";").map((entry) => entry.trim());
  const match = cookies.find((entry) => entry.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1] ?? "") : null;
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = readCookie(COOKIE_KEY);
    if (!existing) {
      setVisible(true);
    }
  }, []);

  const saveChoice = (choice: ConsentChoice) => {
    writeCookie(COOKIE_KEY, choice);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Preferenze cookie"
      className="fixed inset-x-4 bottom-4 z-[10000] rounded-2xl border border-emerald-100 bg-white p-4 shadow-xl sm:inset-x-auto sm:right-6 sm:w-[380px]"
    >
      <p className="text-sm font-semibold text-zinc-900">Cookie e privacy</p>
      <p className="mt-2 text-sm text-zinc-600">
        Usiamo cookie tecnici per il funzionamento del sito e, con il tuo consenso, cookie analitici anonimi.
        Consulta l&apos;
        <Link href="/privacy" className="font-semibold text-emerald-700 hover:underline">
          informativa privacy
        </Link>
        .
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => saveChoice("necessary")}
          className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300"
        >
          Solo necessari
        </button>
        <button
          type="button"
          onClick={() => saveChoice("all")}
          className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
        >
          Accetta tutti
        </button>
      </div>
    </div>
  );
}
