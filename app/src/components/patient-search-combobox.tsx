"use client";

import { useMemo, useState } from "react";

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
      <input
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
        className={className}
      />
      <datalist id={listId}>
        {patients.map((patient) => (
          <option key={patient.id} value={patient.fullName} />
        ))}
      </datalist>
    </>
  );
}
