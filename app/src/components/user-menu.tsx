"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { SignOutButton } from "./sign-out-button";
import { FidatiDialog } from "./fidati-dialog";
import {
  AGENDA_CHRONOLOGICAL_COOKIE,
  AGENDA_CHRONOLOGICAL_STORAGE_KEY,
  CALENDAR_AVAILABILITY_WARNING_BYPASS_STORAGE_KEY,
  CALENDAR_CLOSURE_WARNING_BYPASS_STORAGE_KEY,
  CALENDAR_COMPACT_PATIENT_NAME_STORAGE_KEY,
  HOME_SCREEN_STORAGE_KEY,
  PATIENT_POST_CREATE_STORAGE_KEY,
  PATIENT_LIST_AUTO_FILTER_STORAGE_KEY,
  USER_TIME_ZONE_COOKIE,
  USER_TIME_ZONE_STORAGE_KEY,
} from "@/lib/app-preferences";
import { APP_THEME_EVENT, APP_THEME_STORAGE_KEY, isThemePreference, type ThemePreference } from "@/lib/theme";
import clsx from "clsx";
import { updatePracticeTimeZone } from "@/app/_actions/practice-settings";
import {
  DEFAULT_PRACTICE_TIME_ZONE,
  PRACTICE_TIME_ZONE_OPTIONS,
  PRACTICE_TIME_ZONE_STORAGE_KEY,
  isPracticeTimeZone,
  type PracticeTimeZone,
} from "@/lib/practice-time-zone";
import {
  DISPLAY_TIME_ZONE_OPTIONS,
  getBrowserUserDisplayTimeZone,
  resolveUserDisplayTimeZone,
} from "@/lib/user-display-time-zone";

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
  practiceTimeZone?: PracticeTimeZone;
  displayTimeZone?: string;
  canManagePracticeTimeZone?: boolean;
  isStaff?: boolean;
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
  practiceTimeZone = DEFAULT_PRACTICE_TIME_ZONE,
  displayTimeZone = DEFAULT_PRACTICE_TIME_ZONE,
  canManagePracticeTimeZone = false,
  isStaff = true,
}: Props) {
  const router = useRouter();
  const initialHomeScreen =
    typeof window === "undefined"
      ? "/dashboard"
      : window.localStorage.getItem(HOME_SCREEN_STORAGE_KEY) ?? "/dashboard";
  const initialPatientPostCreate =
    typeof window === "undefined"
      ? "dashboard"
      : window.localStorage.getItem(PATIENT_POST_CREATE_STORAGE_KEY) ?? "dashboard";
  const initialPatientAutoFilter =
    typeof window === "undefined"
      ? true
      : window.localStorage.getItem(PATIENT_LIST_AUTO_FILTER_STORAGE_KEY) !== "false";
  const initialCalendarCompactPatientName =
    typeof window === "undefined"
      ? false
      : window.localStorage.getItem(CALENDAR_COMPACT_PATIENT_NAME_STORAGE_KEY) === "true";
  const initialAgendaChronological =
    typeof window === "undefined"
      ? false
      : window.localStorage.getItem(AGENDA_CHRONOLOGICAL_STORAGE_KEY) === "true";
  const initialCalendarClosureWarningBypass =
    typeof window === "undefined"
      ? false
      : window.localStorage.getItem(CALENDAR_CLOSURE_WARNING_BYPASS_STORAGE_KEY) === "true";
  const initialCalendarAvailabilityWarningBypass =
    typeof window === "undefined"
      ? false
      : window.localStorage.getItem(CALENDAR_AVAILABILITY_WARNING_BYPASS_STORAGE_KEY) === "true";
  const initialThemePreference =
    typeof window === "undefined"
      ? "system"
      : (() => {
          const stored = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
          return isThemePreference(stored) ? stored : "system";
        })();
  const initialPracticeTimeZone =
    typeof window === "undefined"
      ? practiceTimeZone
      : (() => {
          const stored = window.localStorage.getItem(PRACTICE_TIME_ZONE_STORAGE_KEY);
          return isPracticeTimeZone(stored) ? stored : practiceTimeZone;
        })();
  const initialDisplayTimeZone =
    typeof window === "undefined"
      ? displayTimeZone
      : getBrowserUserDisplayTimeZone(displayTimeZone);
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [fidatiOpen, setFidatiOpen] = useState(false);
  const [homeScreen, setHomeScreen] = useState(initialHomeScreen);
  const [patientPostCreate, setPatientPostCreate] = useState(initialPatientPostCreate);
  const [patientAutoFilter, setPatientAutoFilter] = useState(initialPatientAutoFilter);
  const [calendarCompactPatientName, setCalendarCompactPatientName] = useState(initialCalendarCompactPatientName);
  const [agendaChronological, setAgendaChronological] = useState(initialAgendaChronological);
  const [calendarClosureWarningBypass, setCalendarClosureWarningBypass] = useState(
    initialCalendarClosureWarningBypass
  );
  const [calendarAvailabilityWarningBypass, setCalendarAvailabilityWarningBypass] = useState(
    initialCalendarAvailabilityWarningBypass
  );
  const [themePreference, setThemePreference] = useState<ThemePreference>(initialThemePreference);
  const [selectedPracticeTimeZone, setSelectedPracticeTimeZone] =
    useState<PracticeTimeZone>(initialPracticeTimeZone);
  const [selectedDisplayTimeZone, setSelectedDisplayTimeZone] = useState(
    resolveUserDisplayTimeZone(initialDisplayTimeZone, displayTimeZone)
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelectedPracticeTimeZone(practiceTimeZone);
  }, [practiceTimeZone]);

  useEffect(() => {
    setSelectedDisplayTimeZone(resolveUserDisplayTimeZone(displayTimeZone, practiceTimeZone));
  }, [displayTimeZone, practiceTimeZone]);

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

  const selectedHomeScreen = homeOptions.some((option) => option.value === homeScreen)
    ? homeScreen
    : (homeOptions[0]?.value ?? "/dashboard");

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
        className="flex items-center gap-3 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-emerald-200 hover:text-emerald-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-emerald-700 dark:hover:text-emerald-300"
        aria-expanded={open}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt="Avatar"
            className="h-9 w-9 rounded-full border border-zinc-200 object-cover dark:border-zinc-700"
          />
        ) : (
          <span className="grid h-9 w-9 place-items-center rounded-full border border-zinc-200 bg-zinc-100 text-[11px] font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {initials}
          </span>
        )}
        <span className="flex flex-col items-start leading-tight">
          <span className="text-sm font-semibold">{name || email}</span>
          {roleLabel ? (
            <span className="text-[11px] uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300">{roleLabel}</span>
          ) : null}
        </span>
        <span className={`text-xs transition ${open ? "rotate-180" : ""}`} aria-hidden>
          ▼
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col divide-y divide-zinc-100 text-sm font-semibold text-zinc-800 dark:divide-zinc-800 dark:text-zinc-100">
            <Link
              href={profileHref}
              className="flex items-center gap-2 px-4 py-3 hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
              onClick={() => setOpen(false)}
            >
              <span aria-hidden>👤</span>
              Profilo
            </Link>
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-3 text-left hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
              onClick={() => {
                setOpen(false);
                setShowSettings(true);
              }}
            >
              <span aria-hidden>⚙️</span>
              Personalizza
            </button>
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-3 text-left hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
              onClick={() => {
                setOpen(false);
                setFidatiOpen(true);
              }}
            >
              <span aria-hidden>▶️</span>
              Fidati.
            </button>
            {adminHref && adminLabel ? (
              <Link
                href={adminHref}
                className="flex items-center gap-2 px-4 py-3 hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
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

      {showSettings && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[100000] flex items-stretch justify-center bg-zinc-950/40 px-4 py-3 backdrop-blur-sm sm:items-center sm:py-6">
              <div
                ref={settingsRef}
                className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:max-h-[calc(100vh-3rem)]"
              >
                <div className="shrink-0 border-b border-zinc-100 bg-zinc-50/50 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900/30">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                      Personalizza App
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowSettings(false)}
                      className="rounded-full border border-zinc-200 bg-white p-2 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {isStaff
                      ? "Modifica le preferenze per adattare SORRISO al tuo flusso di lavoro."
                      : "Personalizza l'aspetto e il fuso orario del tuo spazio pazienti."}
                  </p>
                </div>

                <div
                  className={clsx(
                    "grid min-h-0 flex-1 gap-6 overflow-y-auto p-6",
                    isStaff ? "lg:grid-cols-2" : "max-w-xl"
                  )}
                >
                  {isStaff ? (
                  <section className="space-y-4">
                    <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-400">
                      <span>🏠</span> Navigazione
                    </h4>
                    <div className="grid gap-4">
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Schermata iniziale</span>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">La pagina visualizzata subito dopo l&apos;accesso.</p>
                        <select
                          value={selectedHomeScreen}
                          onChange={(event) => setHomeScreen(event.target.value)}
                          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900/30"
                        >
                          {homeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Destinazione post-registrazione</span>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Dove l&apos;app ti porta dopo aver creato un nuovo paziente.</p>
                        <select
                          value={patientPostCreate}
                          onChange={(event) => setPatientPostCreate(event.target.value)}
                          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900/30"
                        >
                          <option value="dashboard">Giornata</option>
                          <option value="patients">Lista pazienti</option>
                          <option value="patient_detail">Scheda paziente</option>
                        </select>
                      </label>
                    </div>
                  </section>
                  ) : null}

                  <section className="space-y-4">
                    <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-blue-700 dark:text-blue-400">
                      <span>🎨</span> Interfaccia
                    </h4>
                    <div className="space-y-4">
                      <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Aspetto e Tema</span>
                      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-zinc-100 bg-zinc-50/50 p-1 dark:border-zinc-800 dark:bg-zinc-900/50">
                        {[
                          { value: "light", label: "Chiaro", icon: "☀️" },
                          { value: "system", label: "Sistema", icon: "🌓" },
                          { value: "dark", label: "Scuro", icon: "🌙" },
                        ].map((t) => (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => setThemePreference(t.value as ThemePreference)}
                            className={clsx(
                              "flex flex-col items-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-all",
                              themePreference === t.value
                                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-zinc-700"
                                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                            )}
                          >
                            <span className="text-lg">{t.icon}</span>
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Fuso orario visualizzazione</span>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Tutte le date e gli orari mostrati nell&apos;app usano questo fuso.
                        </p>
                        <select
                          value={selectedDisplayTimeZone}
                          onChange={(event) => setSelectedDisplayTimeZone(event.target.value)}
                          disabled={isSaving}
                          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900/30 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                        >
                          {DISPLAY_TIME_ZONE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {isStaff ? (
                        <label className="flex flex-col gap-2">
                          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Fuso orario studio</span>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Fuso orario utilizzato per le automazioni lato server.
                          </p>
                          <select
                            value={selectedPracticeTimeZone}
                            onChange={(event) =>
                              setSelectedPracticeTimeZone(event.target.value as PracticeTimeZone)
                            }
                            disabled={!canManagePracticeTimeZone || isSaving}
                            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900/30 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                          >
                            {PRACTICE_TIME_ZONE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          {!canManagePracticeTimeZone ? (
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                              Solo admin e manager possono modificare il fuso orario dello studio.
                            </p>
                          ) : null}
                        </label>
                      ) : null}
                    </div>
                  </section>

                  {isStaff ? (
                  <section className="space-y-4 lg:col-span-2">
                    <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-purple-700 dark:text-purple-400">
                      <span>🛡️</span> Funzionalità
                    </h4>
                    <div className="grid gap-3 lg:grid-cols-4">
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <div>
                        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Filtro automatico lista</span>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Applica filtri intelligenti quando cerchi pazienti.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPatientAutoFilter(!patientAutoFilter)}
                        className={clsx(
                          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                          patientAutoFilter ? "bg-emerald-600" : "bg-zinc-200 dark:bg-zinc-700"
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={clsx(
                            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                            patientAutoFilter ? "translate-x-5" : "translate-x-0"
                          )}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <div>
                        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Nome paziente in agenda compatta</span>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          🗓️ Mostra nome del paziente al posto della terapia.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCalendarCompactPatientName(!calendarCompactPatientName)}
                        className={clsx(
                          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                          calendarCompactPatientName ? "bg-emerald-600" : "bg-zinc-200 dark:bg-zinc-700"
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={clsx(
                            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                            calendarCompactPatientName ? "translate-x-5" : "translate-x-0"
                          )}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <div>
                        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Ordine appuntamenti agenda</span>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          ⬇️ Elenca appuntamenti esistenti in ordine cronologico.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAgendaChronological(!agendaChronological)}
                        className={clsx(
                          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                          agendaChronological ? "bg-emerald-600" : "bg-zinc-200 dark:bg-zinc-700"
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={clsx(
                            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                            agendaChronological ? "translate-x-5" : "translate-x-0"
                          )}
                        />
                      </button>
                    </div>
                    <div className="rounded-2xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <div>
                        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Avvisi calendario</span>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          Scegli quali avvisi saltare quando inserisci o modifichi appuntamenti.
                        </p>
                      </div>
                      <div className="mt-4 space-y-3">
                        <label className="flex items-center justify-between gap-4 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                          <span>Salta avviso giorni chiusi.</span>
                          <input
                            type="checkbox"
                            checked={calendarClosureWarningBypass}
                            onChange={(event) => setCalendarClosureWarningBypass(event.target.checked)}
                            className="peer sr-only"
                          />
                          <span className="relative inline-flex h-6 w-12 shrink-0 rounded-full bg-zinc-200 transition-colors peer-checked:bg-emerald-600 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-500 dark:bg-zinc-700">
                            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-6" />
                          </span>
                        </label>
                        <label className="flex items-center justify-between gap-4 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                          <span>Salta avviso disponibilità medico</span>
                          <input
                            type="checkbox"
                            checked={calendarAvailabilityWarningBypass}
                            onChange={(event) => setCalendarAvailabilityWarningBypass(event.target.checked)}
                            className="peer sr-only"
                          />
                          <span className="relative inline-flex h-6 w-12 shrink-0 rounded-full bg-zinc-200 transition-colors peer-checked:bg-emerald-600 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-500 dark:bg-zinc-700">
                            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-6" />
                          </span>
                        </label>
                      </div>
                    </div>
                    </div>
                  </section>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center justify-end gap-3 border-t border-zinc-100 bg-zinc-50/50 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900/30">
                  {saveMessage ? (
                    <p className="mr-auto text-xs text-zinc-500 dark:text-zinc-400">{saveMessage}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-200 bg-white px-6 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      setSaveMessage(null);
                      startSaving(async () => {
                        try {
                          if (isStaff) {
                            window.localStorage.setItem(HOME_SCREEN_STORAGE_KEY, selectedHomeScreen);
                            window.localStorage.setItem(
                              PATIENT_POST_CREATE_STORAGE_KEY,
                              patientPostCreate
                            );
                            window.localStorage.setItem(
                              PATIENT_LIST_AUTO_FILTER_STORAGE_KEY,
                              patientAutoFilter ? "true" : "false"
                            );
                            window.localStorage.setItem(
                              CALENDAR_COMPACT_PATIENT_NAME_STORAGE_KEY,
                              calendarCompactPatientName ? "true" : "false"
                            );
                            window.localStorage.setItem(
                              AGENDA_CHRONOLOGICAL_STORAGE_KEY,
                              agendaChronological ? "true" : "false"
                            );
                            window.localStorage.setItem(
                              CALENDAR_CLOSURE_WARNING_BYPASS_STORAGE_KEY,
                              calendarClosureWarningBypass ? "true" : "false"
                            );
                            window.localStorage.setItem(
                              CALENDAR_AVAILABILITY_WARNING_BYPASS_STORAGE_KEY,
                              calendarAvailabilityWarningBypass ? "true" : "false"
                            );
                            document.cookie = `${AGENDA_CHRONOLOGICAL_COOKIE}=${
                              agendaChronological ? "true" : "false"
                            }; path=/; max-age=31536000; SameSite=Lax`;
                            window.dispatchEvent(
                              new CustomEvent("patient-auto-filter-changed", {
                                detail: { enabled: patientAutoFilter },
                              })
                            );
                            window.dispatchEvent(
                              new CustomEvent("calendar-compact-patient-name-changed", {
                                detail: { enabled: calendarCompactPatientName },
                              })
                            );
                          }
                          window.localStorage.setItem(APP_THEME_STORAGE_KEY, themePreference);
                          const normalizedDisplayTimeZone = resolveUserDisplayTimeZone(
                            selectedDisplayTimeZone,
                            practiceTimeZone
                          );
                          window.localStorage.setItem(
                            USER_TIME_ZONE_STORAGE_KEY,
                            normalizedDisplayTimeZone
                          );
                          document.cookie = `${USER_TIME_ZONE_COOKIE}=${encodeURIComponent(
                            normalizedDisplayTimeZone
                          )}; path=/; max-age=31536000; SameSite=Lax`;
                          window.dispatchEvent(new CustomEvent(APP_THEME_EVENT));

                          if (isStaff && canManagePracticeTimeZone) {
                            const savedTimeZone = await updatePracticeTimeZone(
                              selectedPracticeTimeZone,
                            );
                            window.localStorage.setItem(
                              PRACTICE_TIME_ZONE_STORAGE_KEY,
                              savedTimeZone,
                            );
                          }

                          router.refresh();
                          setShowSettings(false);
                        } catch (error) {
                          setSaveMessage(
                            error instanceof Error
                              ? error.message
                              : "Impossibile salvare le preferenze."
                          );
                        }
                      });
                    }}
                    className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-8 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
                  >
                    {isSaving ? "Salvataggio..." : "Salva modifiche"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
      <FidatiDialog open={fidatiOpen} onClose={() => setFidatiOpen(false)} />
    </div>
  );
}
