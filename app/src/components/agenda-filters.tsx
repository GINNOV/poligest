"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { APPOINTMENT_STATUSES, type AppointmentStatus } from "@/lib/client-enums";

type Props = {
  statusLabels: Record<AppointmentStatus, string>;
  statusValue?: string;
  dateValue?: string;
  searchValue?: string;
  basePath?: string;
};

export function AgendaFilters({ statusLabels, statusValue, dateValue, searchValue, basePath = "/agenda/appuntamenti" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const params = new URLSearchParams(searchParams.toString());

        const date = (formData.get("date") as string) ?? "";
        const status = (formData.get("status") as string) ?? "";
        const q = (formData.get("q") as string) ?? "";

        if (date) params.set("date", date);
        else params.delete("date");

        if (status) params.set("status", status);
        else params.delete("status");

        if (q) params.set("q", q);
        else params.delete("q");

        startTransition(() => {
          router.push(`${basePath}?${params.toString()}`);
        });
      }}
    >
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
        Data
        <input
          type="date"
          name="date"
          defaultValue={dateValue ?? ""}
          className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
        Stato
        <select
          name="status"
          defaultValue={statusValue ?? ""}
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        >
          <option value="">Tutti</option>
          {APPOINTMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 sm:col-span-1">
        Cerca
        <input
          type="text"
          name="q"
          defaultValue={searchValue ?? ""}
          placeholder="Titolo, paziente, medico"
          className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        />
      </label>
      <div className="col-span-full flex justify-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Applico..." : "Applica filtri"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              router.push(basePath);
            })
          }
          className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Mostra tutto
        </button>
      </div>
    </form>
  );
}
