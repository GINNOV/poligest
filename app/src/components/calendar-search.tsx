"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export function CalendarSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [prevSearchParams, setPrevSearchParams] = useState(searchParams);

  if (searchParams !== prevSearchParams) {
    setPrevSearchParams(searchParams);
    setQuery(searchParams.get("q") ?? "");
  }

  const handleSearch = (value: string) => {
    setQuery(value);
    startTransition(() => {
      const nextParams = new URLSearchParams(searchParams.toString());
      if (value) {
        nextParams.set("q", value);
      } else {
        nextParams.delete("q");
      }
      router.push(`/calendar?${nextParams.toString()}`);
    });
  };

  return (
    <div className="relative w-full sm:w-64">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <svg
          className={`h-4 w-4 ${isPending ? "animate-spin text-emerald-500" : "text-zinc-400"}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {isPending ? (
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          ) : (
            <>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </>
          )}
        </svg>
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Cerca paziente o note..."
        className="h-10 w-full rounded-full border border-zinc-200 bg-white pl-10 pr-10 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
      />
      {query && (
        <button
          type="button"
          onClick={() => handleSearch("")}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
