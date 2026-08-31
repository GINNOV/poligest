"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export function CertificatesFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [type, setType] = useState(searchParams.get("type") || "ALL");

  const applyFilters = (newSearch: string, newType: string) => {
    const params = new URLSearchParams();
    if (newSearch.trim()) params.set("search", newSearch.trim());
    if (newType && newType !== "ALL") params.set("type", newType);

    startTransition(() => {
      router.push(`/pazienti/certificati?${params.toString()}`);
    });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              applyFilters(e.target.value, type);
            }}
            placeholder="Cerca per paziente, numero certificato, diagnosi..."
            className="h-10 w-full rounded-full border border-zinc-200 bg-white pl-4 pr-10 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                applyFilters("", type);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400 hover:text-zinc-600"
            >
              ✕
            </button>
          ) : null}
        </div>

        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            applyFilters(search, e.target.value);
          }}
          className="h-10 rounded-full border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-700 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
        >
          <option value="ALL">Tutte le tipologie</option>
          <option value="WORK_INCAPACITY">Riposo Lavorativo / Malattia</option>
          <option value="ATTENDANCE">Presenza Cure</option>
          <option value="INSURANCE">Assicurazione</option>
          <option value="CUSTOM">Personalizzato</option>
        </select>
      </div>

      {isPending ? (
        <span className="text-xs text-zinc-400 animate-pulse">Aggiornamento...</span>
      ) : null}
    </div>
  );
}
