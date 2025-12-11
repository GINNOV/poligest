"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-12">
      <div className="max-w-xl rounded-2xl border border-rose-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-6 flex justify-center">
          <Image
            src="/status/error.png"
            alt="Errore applicazione"
            width={360}
            height={220}
            className="h-auto max-w-full"
            priority
          />
        </div>
        <h1 className="text-2xl font-bold text-rose-800">Si è verificato un errore</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Qualcosa è andato storto. Puoi riprovare oppure tornare alla pagina principale.
        </p>
        {error?.message ? (
          <p className="mt-3 rounded-lg bg-rose-50 px-4 py-2 text-left text-xs text-rose-700">
            Dettagli: {error.message}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            Riprova
          </button>
          <Link
            href="/"
            className="rounded-full border border-zinc-200 px-5 py-2 text-sm font-semibold text-zinc-800 transition hover:border-emerald-300 hover:text-emerald-700"
          >
            Vai alla home
          </Link>
        </div>
      </div>
    </div>
  );
}
