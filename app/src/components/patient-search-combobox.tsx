"use client";

import { useMemo, useRef, useState } from "react";
import {
  getPatientOptionValue,
  resolvePatientFromQuery,
  type PatientSearchOption,
} from "@/lib/patient-search";

type PatientOption = PatientSearchOption;

type Props = {
  name: string;
  patients: PatientOption[];
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  allowNew?: boolean;
  onSelect?: (id: string) => void;
};

export function PatientSearchCombobox({
  name,
  patients,
  defaultValue = "",
  placeholder = "Cerca paziente",
  className,
  allowNew = false,
  onSelect,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const defaultPatient = useMemo(
    () => patients.find((patient) => patient.id === defaultValue) ?? null,
    [defaultValue, patients],
  );
  const [query, setQuery] = useState(
    defaultPatient ? getPatientOptionValue(defaultPatient) : "",
  );
  const [selectedId, setSelectedId] = useState(defaultValue);
  const [prevDefaultValue, setPrevDefaultValue] = useState(defaultValue);

  if (defaultValue !== prevDefaultValue) {
    setPrevDefaultValue(defaultValue);
    setSelectedId(defaultValue);
    const p = patients.find((patient) => patient.id === defaultValue);
    setQuery(p ? getPatientOptionValue(p) : "");
  }

  const listId = `${name}-options`;

  return (
    <>
      <input type="hidden" name={name} value={selectedId} />
      <div className="relative">
        <input
          ref={inputRef}
          list={listId}
          value={query}
          type="text"
          autoComplete="off"
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            
            if (allowNew && nextQuery.trim().toLowerCase() === "+ nuovo cliente") {
              setSelectedId("new");
              onSelect?.("new");
              return;
            }

            const match = resolvePatientFromQuery(nextQuery, patients);
            const nextId = match?.id ?? "";
            setSelectedId(nextId);
            onSelect?.(nextId);
          }}
          onBlur={() => {
            // If query doesn't match selectedId name, and not allowNew 'new', clear or reset?
            // For now, let's keep it simple.
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
              onSelect?.("");
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
        {allowNew && <option value="+ Nuovo cliente" />}
        {patients.map((patient) => {
          const optionValue = getPatientOptionValue(patient);
          return <option key={patient.id} value={optionValue} />;
        })}
      </datalist>
    </>
  );
}
