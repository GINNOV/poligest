"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Role } from "@prisma/client";

export type AuditFilterUser = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
};

type AuditFiltersFormProps = {
  labels: {
    search: string;
    searchPlaceholder: string;
    date: string;
    role: string;
    user: string;
    userPlaceholder: string;
    type: string;
    all: string;
    apply: string;
    reset: string;
    applyAria: string;
    resetAria: string;
    roleHint: string;
    userCount: string;
  };
  values: {
    q: string;
    date: string;
    role: string;
    userId: string;
    type: string;
  };
  users: AuditFilterUser[];
  actionTypes: string[];
  roleLabels: Record<Role, string>;
};

const inputClassName =
  "h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-emerald-500/10";

function formatUserOption(user: AuditFilterUser) {
  if (user.name && user.email) return `${user.name} (${user.email})`;
  return user.name || user.email;
}

function resolveUserFromQuery(query: string, users: AuditFilterUser[]) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  return (
    users.find((user) => formatUserOption(user).toLowerCase() === normalized) ??
    users.find((user) => user.email.toLowerCase() === normalized) ??
    users.find((user) => (user.name ?? "").toLowerCase() === normalized) ??
    null
  );
}

export function AuditFiltersForm({
  labels,
  values,
  users,
  actionTypes,
  roleLabels,
}: AuditFiltersFormProps) {
  const userInputRef = useRef<HTMLInputElement>(null);
  const [role, setRole] = useState(values.role);
  const [selectedUserId, setSelectedUserId] = useState(values.userId);
  const [userQuery, setUserQuery] = useState(() => {
    const selected = users.find((user) => user.id === values.userId);
    return selected ? formatUserOption(selected) : "";
  });

  const filteredUsers = useMemo(
    () => (role ? users.filter((user) => user.role === role) : users),
    [role, users],
  );

  const handleRoleChange = (nextRole: string) => {
    setRole(nextRole);
    if (!selectedUserId) return;
    const selected = users.find((user) => user.id === selectedUserId);
    if (selected && nextRole && selected.role !== nextRole) {
      setSelectedUserId("");
      setUserQuery("");
    }
  };

  const listId = "audit-user-options";

  return (
    <form className="space-y-4" method="get">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
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
      </div>

      <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Filtra per utente
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_auto] lg:items-end">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {labels.role}
            <select
              name="role"
              value={role}
              onChange={(event) => handleRoleChange(event.target.value)}
              className={inputClassName}
            >
              <option value="">{labels.all}</option>
              {Object.values(Role).map((roleValue) => (
                <option key={roleValue} value={roleValue}>
                  {roleLabels[roleValue] ?? roleValue}
                </option>
              ))}
            </select>
            <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">{labels.roleHint}</span>
          </label>

          <div className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            <span>{labels.user}</span>
            <input type="hidden" name="userId" value={selectedUserId} />
            <div className="relative">
              <input
                ref={userInputRef}
                list={listId}
                type="search"
                value={userQuery}
                autoComplete="off"
                placeholder={labels.userPlaceholder}
                onChange={(event) => {
                  const nextQuery = event.target.value;
                  setUserQuery(nextQuery);
                  const match = resolveUserFromQuery(nextQuery, filteredUsers);
                  setSelectedUserId(match?.id ?? "");
                }}
                className={`${inputClassName} pr-10`}
              />
              {userQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setUserQuery("");
                    setSelectedUserId("");
                    userInputRef.current?.focus();
                  }}
                  aria-label="Cancella utente"
                  className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5"
                  >
                    <path d="M6 6l8 8" />
                    <path d="M14 6l-8 8" />
                  </svg>
                </button>
              ) : null}
            </div>
            <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
              {labels.userCount.replace("{count}", String(filteredUsers.length))}
            </span>
            <datalist id={listId}>
              {filteredUsers.map((user) => (
                <option key={user.id} value={formatUserOption(user)} />
              ))}
            </datalist>
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
        </div>
      </div>
    </form>
  );
}