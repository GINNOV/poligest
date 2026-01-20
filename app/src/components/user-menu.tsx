"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SignOutButton } from "./sign-out-button";
import {
  HOME_SCREEN_STORAGE_KEY,
  PATIENT_POST_CREATE_STORAGE_KEY,
  PATIENT_LIST_AUTO_FILTER_STORAGE_KEY,
} from "@/lib/app-preferences";

type Props = {
  name: string;
  email: string;
  avatarUrl?: string | null;
  roleLabel?: string;
  profileHref?: string;
  adminHref?: string;
  adminLabel?: string;
  signOutUrl?: string;
  allowedHomeScreens?: string[];
};

export function UserMenu({
  name,
  email,
  avatarUrl,
  roleLabel,
  profileHref = "/profilo",
  adminHref,
  adminLabel,
  signOutUrl = "/handler/sign-out",
  allowedHomeScreens,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [homeScreen, setHomeScreen] = useState("/dashboard");
  const [patientPostCreate, setPatientPostCreate] = useState("dashboard");
  const [patientAutoFilter, setPatientAutoFilter] = useState(true);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(HOME_SCREEN_STORAGE_KEY);
    if (stored) {
      setHomeScreen(stored);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(PATIENT_POST_CREATE_STORAGE_KEY);
    if (stored) {
      setPatientPostCreate(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(PATIENT_LIST_AUTO_FILTER_STORAGE_KEY);
    if (stored === "false") {
      setPatientAutoFilter(false);
    }
  }, []);

  useEffect(() => {
    if (!showSettings) return;
    const handleClick = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowSettings(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [showSettings]);

  const homeOptions = useMemo(() => {
    const options = [
      { value: "/dashboard", label: "Giornata" },
      { value: "/agenda", label: "Agenda" },
      { value: "/pazienti", label: "Pazienti" },
      { value: "/finanza", label: "Finanza" },
      { value: "/magazzino", label: "Magazzino" },
    ];
    if (!allowedHomeScreens || allowedHomeScreens.length === 0) {
      return options;
    }
    return options.filter((option) => allowedHomeScreens.includes(option.value));
  }, [allowedHomeScreens]);

  useEffect(() => {
    if (homeOptions.length === 0) return;
    if (!homeOptions.some((option) => option.value === homeScreen)) {
      setHomeScreen(homeOptions[0].value);
    }
  }, [homeOptions, homeScreen]);

  const initials = (name || email || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="relative z-50" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-3 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-emerald-200 hover:text-emerald-800"
        aria-expanded={open}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt="Avatar"
            className="h-9 w-9 rounded-full border border-zinc-200 object-cover"
          />
        ) : (
          <span className="grid h-9 w-9 place-items-center rounded-full border border-zinc-200 bg-zinc-100 text-[11px] font-semibold text-zinc-700">
            {initials}
          </span>
        )}
        <span className="flex flex-col items-start leading-tight">
          <span className="text-sm font-semibold">{name || email}</span>
          {roleLabel ? (
            <span className="text-[11px] uppercase tracking-[0.08em] text-emerald-700">{roleLabel}</span>
          ) : null}
        </span>
        <span className={`text-xs transition ${open ? "rotate-180" : ""}`} aria-hidden>
          ▼
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-zinc-200 bg-white shadow-lg">
          <div className="flex flex-col divide-y divide-zinc-100 text-sm font-semibold text-zinc-800">
            <Link
              href={profileHref}
              className="flex items-center gap-2 px-4 py-3 hover:bg-emerald-50 hover:text-emerald-800"
              onClick={() => setOpen(false)}
            >
              <span aria-hidden>👤</span>
              Profilo
            </Link>
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-3 text-left hover:bg-emerald-50 hover:text-emerald-800"
              onClick={() => {
                setOpen(false);
                setShowSettings(true);
              }}
            >
              <span aria-hidden>⚙️</span>
              Personalizza
            </button>
            {adminHref && adminLabel ? (
              <Link
                href={adminHref}
                className="flex items-center gap-2 px-4 py-3 hover:bg-emerald-50 hover:text-emerald-800"
                onClick={() => setOpen(false)}
              >
                <span aria-hidden>🛠️</span>
                {adminLabel}
              </Link>
            ) : null}
            <div className="px-3 py-2">
              <SignOutButton label="🚪 Esci" signOutUrl={signOutUrl} />
            </div>
          </div>
        </div>
      ) : null}

      {showSettings && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[100000] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10">
              <div
                ref={settingsRef}
                className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
              >
                <div className="mb-3 text-center text-lg font-semibold text-emerald-900">
                  Personalizza
                </div>
                <p className="text-sm text-zinc-600">
                  Impostazioni generali dell&apos;app.
                </p>
                <div className="mt-5 space-y-4">
                  <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                    Schermata iniziale
                    <select
                      value={homeScreen}
                      onChange={(event) => setHomeScreen(event.target.value)}
                      className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    >
                      {homeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                    Dopo registrazione paziente
                    <select
                      value={patientPostCreate}
                      onChange={(event) => setPatientPostCreate(event.target.value)}
                      className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="dashboard">Giornata</option>
                      <option value="patients">Lista pazienti</option>
                      <option value="patient_detail">Scheda paziente</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                    Filtro automatico lista pazienti
                    <select
                      value={patientAutoFilter ? "on" : "off"}
                      onChange={(event) => setPatientAutoFilter(event.target.value === "on")}
                      className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="on">Attivo</option>
                      <option value="off">Disattivo</option>
                    </select>
                  </label>
                </div>
                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.localStorage.setItem(HOME_SCREEN_STORAGE_KEY, homeScreen);
                      window.localStorage.setItem(
                        PATIENT_POST_CREATE_STORAGE_KEY,
                        patientPostCreate
                      );
                      window.localStorage.setItem(
                        PATIENT_LIST_AUTO_FILTER_STORAGE_KEY,
                        patientAutoFilter ? "true" : "false"
                      );
                      window.dispatchEvent(
                        new CustomEvent("patient-auto-filter-changed", {
                          detail: { enabled: patientAutoFilter },
                        })
                      );
                      setShowSettings(false);
                    }}
                    className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
                  >
                    Salva
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
