"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  initialQuery?: string;
  sortValue?: string;
  basePath?: string;
};

const LIVE_SEARCH_DEBOUNCE_MS = 250;

export function PatientListFilters({ initialQuery, sortValue, basePath = "/pazienti/lista" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery ?? "");
  const [sort, setSort] = useState(sortValue ?? "name_asc");
  const isFirstRun = useRef(true);

  useEffect(() => {
    setQuery(initialQuery ?? "");
  }, [initialQuery]);

  useEffect(() => {
    setSort(sortValue ?? "name_asc");
  }, [sortValue]);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    const handle = window.setTimeout(() => {
      const nextParams = new URLSearchParams(searchParams.toString());

      if (query.trim()) nextParams.set("q", query.trim());
      else nextParams.delete("q");

      if (sort) nextParams.set("sort", sort);
      else nextParams.delete("sort");

      nextParams.delete("page");

      const nextQueryString = nextParams.toString();
      const currentQueryString = searchParams.toString();

      if (nextQueryString === currentQueryString) return;

      startTransition(() => {
        router.push(nextQueryString ? `${basePath}?${nextQueryString}` : basePath);
      });
    }, LIVE_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [basePath, query, router, searchParams, sort, startTransition]);

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3"
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        const nextParams = new URLSearchParams(searchParams.toString());

        if (query.trim()) nextParams.set("q", query.trim());
        else nextParams.delete("q");

        if (sort) nextParams.set("sort", sort);
        else nextParams.delete("sort");

        nextParams.delete("page");

        const nextQueryString = nextParams.toString();
        startTransition(() => {
          router.push(nextQueryString ? `${basePath}?${nextQueryString}` : basePath);
        });
      }}
    >
      <label className="flex flex-1 flex-col gap-2 text-sm font-medium text-zinc-800">
        Cerca
        <input
          type="text"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nome, cognome, email, telefono"
          className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        />
      </label>
      <label className="flex flex-1 flex-col gap-2 text-sm font-medium text-zinc-800 sm:max-w-xs">
        Ordina per
        <select
          name="sort"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        >
          <option value="name_asc">Alfabetico (A-Z)</option>
          <option value="name_desc">Alfabetico (Z-A)</option>
          <option value="date_desc">Data di inserimento (recenti)</option>
          <option value="date_asc">Data di inserimento (meno recenti)</option>
        </select>
      </label>
      <div className="flex gap-2 sm:self-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Applico..." : "Applica"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setQuery("");
            startTransition(() => {
              const nextParams = new URLSearchParams(searchParams.toString());
              nextParams.delete("q");
              nextParams.delete("page");
              if (sort) nextParams.set("sort", sort);
              else nextParams.delete("sort");
              const nextQueryString = nextParams.toString();
              router.push(nextQueryString ? `${basePath}?${nextQueryString}` : basePath);
            });
          }}
          className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Mostra tutto
        </button>
      </div>
    </form>
  );
}
