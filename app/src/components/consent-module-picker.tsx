"use client";

import { useEffect, useMemo, useState } from "react";
import { PatientConsentSection } from "@/components/patient-consent-modal";

type ConsentModule = {
  id: string;
  name: string;
  content: string;
  active: boolean;
  required: boolean;
  sortOrder: number;
};

type Props = {
  modules: ConsentModule[];
  doctors: { id: string; fullName: string }[];
};

const CHANNELS = ["Di persona", "Telefono", "Manuale", "Digitale"];
const CONSENT_REQUIRED_EVENT = "consent-required-status";
const PAPER_CONSENT_OVERRIDE_EVENT = "paper-consent-override-status";
const DEFAULT_PLACE = "Striano";
const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const getTodayDateKey = () => DATE_FORMATTER.format(new Date());

type ModuleState = {
  place: string;
  date: string;
  patientName: string;
  doctorName: string;
  signatureData: string;
  channel: string;
  expiresAt: string;
};

const getDefaultModuleState = (): ModuleState => ({
  place: DEFAULT_PLACE,
  date: getTodayDateKey(),
  patientName: "",
  doctorName: "",
  signatureData: "",
  channel: "Di persona",
  expiresAt: "",
});

export function ConsentModulePicker({ modules, doctors }: Props) {
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");
  const [moduleStates, setModuleStates] = useState<Record<string, ModuleState>>({});
  const [hasPaperConsentOverride, setHasPaperConsentOverride] = useState(() => {
    if (typeof window === "undefined") return false;
    const initialValue = (window as typeof window & { __paperConsentOverride?: boolean })
      .__paperConsentOverride;
    return typeof initialValue === "boolean" ? initialValue : false;
  });
  const orderedModules = useMemo(
    () =>
      [...modules]
        .filter((module) => module.active)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name, "it")),
    [modules],
  );
  const selectedModule = useMemo(
    () => orderedModules.find((module) => module.id === selectedModuleId) ?? null,
    [orderedModules, selectedModuleId],
  );
  const canEdit = Boolean(selectedModule);
  const fallbackState = getDefaultModuleState();
  const currentState = selectedModuleId
    ? moduleStates[selectedModuleId] ?? fallbackState
    : fallbackState;
  const canSubmit =
    Boolean(selectedModuleId) &&
    Boolean(currentState.place) &&
    Boolean(currentState.date) &&
    Boolean(currentState.patientName) &&
    Boolean(currentState.doctorName) &&
    Boolean(currentState.signatureData);
  const requiredModules = orderedModules.filter((module) => module.required);
  const hasAllRequiredSigned = requiredModules.every(
    (module) => Boolean(moduleStates[module.id]?.signatureData),
  );

  const updateModuleState = (moduleId: string, updates: Partial<ModuleState>) => {
    setModuleStates((prev) => {
      const current = prev[moduleId] ?? getDefaultModuleState();
      return { ...prev, [moduleId]: { ...current, ...updates } };
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as typeof window & { __consentRequiredComplete?: boolean }).__consentRequiredComplete =
      hasAllRequiredSigned;
    window.dispatchEvent(
      new CustomEvent(CONSENT_REQUIRED_EVENT, { detail: { complete: hasAllRequiredSigned } })
    );
  }, [hasAllRequiredSigned]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      setHasPaperConsentOverride(Boolean(detail?.enabled));
    };
    window.addEventListener(PAPER_CONSENT_OVERRIDE_EVENT, handler as EventListener);

    const initialValue = (window as typeof window & { __paperConsentOverride?: boolean })
      .__paperConsentOverride;
    if (typeof initialValue === "boolean") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasPaperConsentOverride((prev) => (prev === initialValue ? prev : initialValue));
    }

    return () => window.removeEventListener(PAPER_CONSENT_OVERRIDE_EVENT, handler as EventListener);
  }, []);

  const handleModuleSelect = (moduleId: string) => {
    if (hasPaperConsentOverride) return;
    if (moduleId === selectedModuleId) return;
    setModuleStates((prev) => {
      if (prev[moduleId]) return prev;
      return { ...prev, [moduleId]: getDefaultModuleState() };
    });
    setSelectedModuleId(moduleId);
  };

  return (
    <div className="space-y-4">
      {orderedModules
        .filter((module) => Boolean(moduleStates[module.id]?.signatureData))
        .map((module) => {
          const state = moduleStates[module.id] ?? getDefaultModuleState();
          return (
            <div key={`${module.id}-fields`}>
              <input type="hidden" name="consentModuleIds[]" value={module.id} />
              <input type="hidden" name="consentSignatureData[]" value={state.signatureData} />
              <input type="hidden" name="consentPlace[]" value={state.place} />
              <input type="hidden" name="consentDate[]" value={state.date} />
              <input type="hidden" name="patientSignature[]" value={state.patientName} />
              <input type="hidden" name="doctorSignature[]" value={state.doctorName} />
              <input type="hidden" name="consentChannel[]" value={state.channel} />
              <input type="hidden" name="consentExpiresAt[]" value={state.expiresAt} />
            </div>
          );
        })}

      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orderedModules.map((module) => {
            const isSelected = module.id === selectedModuleId;
            const moduleState = moduleStates[module.id] ?? getDefaultModuleState();
            const isSigned = Boolean(moduleState.signatureData);
            const statusClass = hasPaperConsentOverride
              ? "border-zinc-300 bg-zinc-100 text-zinc-500 opacity-70 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500"
              : isSigned
                ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
                : module.required
                  ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
                  : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
            return (
              <button
                key={module.id}
                type="button"
                disabled={hasPaperConsentOverride}
                onClick={() => handleModuleSelect(module.id)}
                className={`flex min-h-[120px] items-center justify-center rounded-xl border-2 px-4 text-center text-base font-semibold transition ${statusClass} ${
                  hasPaperConsentOverride
                    ? "cursor-not-allowed"
                    : isSelected
                      ? "ring-2 ring-emerald-400"
                      : "hover:brightness-95"
                }`}
              >
                {module.name}
              </button>
            );
          })}
        </div>
        {!selectedModule ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Seleziona un consenso per attivare le opzioni sottostanti.
          </p>
        ) : null}
      </div>

      {canEdit ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 sm:p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <PatientConsentSection
            key={selectedModuleId || "consent-empty"}
            content={selectedModule?.content ?? ""}
            doctors={doctors}
            buttonLabel="Apri informativa e firma"
            moduleLabel={selectedModule?.name ?? ""}
            disabled={!canEdit || hasPaperConsentOverride}
            submitDisabled={!canSubmit || hasPaperConsentOverride}
            showSubmitButton={false}
            requireFields={false}
            markRequired={Boolean(selectedModule?.required)}
            hideIntro
            initialValues={currentState}
            onSignatureChange={(value) => {
              if (!selectedModuleId) return;
              updateModuleState(selectedModuleId, { signatureData: value });
            }}
            onFieldChange={(fields) => {
              if (!selectedModuleId) return;
              updateModuleState(selectedModuleId, fields);
            }}
          />
        </div>
      ) : null}

      {canEdit ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 font-medium text-zinc-800 dark:text-zinc-200">
            Consenso ottenuto via...
            <select
              name="consentChannel"
              disabled={!canEdit || hasPaperConsentOverride}
              value={currentState.channel || "Di persona"}
              onChange={(event) => {
                if (!selectedModuleId) return;
                updateModuleState(selectedModuleId, { channel: event.target.value });
              }}
              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:disabled:bg-zinc-900 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
            >
              {CHANNELS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-medium text-zinc-800 dark:text-zinc-200">
            Scadenza (opzionale)
            <input
              type="date"
              name="consentExpiresAt"
              disabled={!canEdit || hasPaperConsentOverride}
              value={currentState.expiresAt}
              onChange={(event) => {
                if (!selectedModuleId) return;
                updateModuleState(selectedModuleId, { expiresAt: event.target.value });
              }}
              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:disabled:bg-zinc-900 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
