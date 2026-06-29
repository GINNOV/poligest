"use client";

import Link from "next/link";
import { Role } from "@prisma/client";

type AuditFiltersFormProps = {
  labels: {
    search: string;
    searchPlaceholder: string;
    date: string;
    role: string;
    type: string;
    all: string;
    apply: string;
    reset: string;
    applyAria: string;
    resetAria: string;
    roleHint: string;
  };
  values: {
    q: string;
    date: string;
    role: string;
    type: string;
  };
  actionTypes: string[];
  roleLabels: Record<Role, string>;
};

const inputClassName =
  "h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-emerald-500/10";

export function AuditFiltersForm({
  labels,
  values,
  actionTypes,
  roleLabels,
}: AuditFiltersFormProps) {
  return (
    <form className="space-y-4" method="get">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200 xl:col-span-2">
          {labels.search}
          <input
            type="search"
            name="q"
            defaultValue={values.q}
            placeholder={labels.searchPlaceholder}
            className={inputClassName}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {labels.date}
          <input type="date" name="date" defaultValue={values.date} className={inputClassName} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {labels.type}
          <select name="type" defaultValue={values.type} className={inputClassName}>
            <option value="">{labels.all}</option>
            {actionTypes.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {labels.role}
          <select name="role" defaultValue={values.role} className={inputClassName}>
            <option value="">{labels.all}</option>
            {Object.values(Role).map((roleValue) => (
              <option key={roleValue} value={roleValue}>
                {roleLabels[roleValue] ?? roleValue}
              </option>
            ))}
          </select>
          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">{labels.roleHint}</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          aria-label={labels.applyAria}
          className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600"
        >
          {labels.apply}
        </button>
        <Link
          href="/admin/audit"
          aria-label={labels.resetAria}
          className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-emerald-800 dark:hover:text-emerald-500"
        >
          {labels.reset}
        </Link>
      </div>
    </form>
  );
}