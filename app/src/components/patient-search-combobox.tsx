"use client";

import { useMemo, useRef, useState } from "react";

type PatientOption = {
  id: string;
  fullName: string;
};

type Props = {
  name: string;
  patients: PatientOption[];
  defaultValue?: string;
  placeholder?: string;
  className?: string;
};

export function PatientSearchCombobox({
  name,
  patients,
  defaultValue = "",
  placeholder = "Cerca paziente",
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const defaultPatient = useMemo(
    () => patients.find((patient) => patient.id === defaultValue) ?? null,
    [defaultValue, patients],
  );
  const [query, setQuery] = useState(defaultPatient?.fullName ?? "");
  const [selectedId, setSelectedId] = useState(defaultPatient?.id ?? "");

  const listId = `${name}-options`;

  return (
    <>
      <input type="hidden" name={name} value={selectedId} />
      <div className="relative">
        <input
          ref={inputRef}
          list={listId}
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            const match = patients.find(
              (patient) => patient.fullName.toLowerCase() === nextQuery.trim().toLowerCase(),
            );
            setSelectedId(match?.id ?? "");
          }}
          placeholder={placeholder}
          className={
            className
              ? `${className} pr-10 font-semibold text-zinc-950 dark:text-white`
              : "pr-10 font-semibold text-zinc-950 dark:text-white"
          }
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSelectedId("");
              inputRef.current?.focus();
            }}
            aria-label="Cancella paziente"
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
      <datalist id={listId}>
        {patients.map((patient) => (
          <option key={patient.id} value={patient.fullName} />
        ))}
      </datalist>
    </>
  );
}
