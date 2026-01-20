"use client";

import { useCallback } from "react";

const MONTH_MAP: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  H: 6,
  L: 7,
  M: 8,
  P: 9,
  R: 10,
  S: 11,
  T: 12,
};

function parseBirthDateFromTaxId(taxId: string): string | null {
  if (taxId.length !== 16) return null;
  const yearRaw = taxId.slice(6, 8);
  const monthRaw = taxId.slice(8, 9);
  const dayRaw = taxId.slice(9, 11);
  if (!/^\d{2}$/.test(yearRaw) || !/^\d{2}$/.test(dayRaw)) return null;
  const month = MONTH_MAP[monthRaw];
  if (!month) return null;

  const dayValueRaw = Number.parseInt(dayRaw, 10);
  const dayValue = dayValueRaw > 40 ? dayValueRaw - 40 : dayValueRaw;
  if (dayValue < 1 || dayValue > 31) return null;

  const yearValue = Number.parseInt(yearRaw, 10);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentTwoDigits = currentYear % 100;
  const centuryBase = yearValue <= currentTwoDigits ? Math.floor(currentYear / 100) : Math.floor(currentYear / 100) - 1;
  const fullYear = centuryBase * 100 + yearValue;

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${fullYear}-${pad(month)}-${pad(dayValue)}`;
}

export function TaxIdBirthDateButton() {
  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget;
    const form = button.closest("form");
    if (!form) return;
    const taxInput = form.querySelector<HTMLInputElement>('input[name="taxId"]');
    const birthInput = form.querySelector<HTMLInputElement>('input[name="birthDate"]');
    if (!taxInput || !birthInput) return;
    const taxId = (taxInput.value || "").trim().toUpperCase();
    const parsedBirthDate = parseBirthDateFromTaxId(taxId);
    if (!parsedBirthDate) return;
    birthInput.value = parsedBirthDate;
    birthInput.dispatchEvent(new Event("input", { bubbles: true }));
    birthInput.dispatchEvent(new Event("change", { bubbles: true }));
  }, []);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition hover:border-emerald-200 hover:text-emerald-700"
      aria-label="Imposta data di nascita da codice fiscale"
      title="Imposta data di nascita da codice fiscale"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M4 7h16" />
        <path d="M7 4v6" />
        <path d="M17 4v6" />
        <rect x="4" y="7" width="16" height="13" rx="2" />
        <path d="M9 12h6" />
        <path d="M12 9v6" />
      </svg>
    </button>
  );
}
