"use client";

import { useMemo, useState } from "react";
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

export function ConsentModulePicker({ modules, doctors }: Props) {
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");
  const [formState, setFormState] = useState({
    place: "",
    date: "",
    patientName: "",
    doctorName: "",
    signatureData: "",
  });
  const [dirty, setDirty] = useState(false);
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
  const [pendingModuleId, setPendingModuleId] = useState<string | null>(null);
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
  const canSubmit =
    Boolean(selectedModuleId) &&
    Boolean(formState.place) &&
    Boolean(formState.date) &&
    Boolean(formState.patientName) &&
    Boolean(formState.doctorName) &&
    Boolean(formState.signatureData);

  const markDirty = () => {
    if (!dirty) {
      setDirty(true);
    }
  };

  const applyModuleSwitch = (moduleId: string) => {
    if (moduleId === selectedModuleId) return;
    setSelectedModuleId(moduleId);
    setFormState({
      place: "",
      date: "",
      patientName: "",
      doctorName: "",
      signatureData: "",
    });
    setDirty(false);
  };
  const handleModuleSelect = (moduleId: string) => {
    if (moduleId === selectedModuleId) return;
    if (dirty) {
      setPendingModuleId(moduleId);
      setShowSwitchConfirm(true);
      return;
    }
    applyModuleSwitch(moduleId);
  };

  return (
    <div className="space-y-4">
      <input type="hidden" name="consentModuleId" value={selectedModuleId} />

      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orderedModules.map((module) => {
            const isSelected = module.id === selectedModuleId;
            return (
              <button
                key={module.id}
                type="button"
                onClick={() => handleModuleSelect(module.id)}
                className={`flex min-h-[120px] items-center justify-center rounded-xl border-2 px-4 text-center text-base font-semibold transition ${
                  isSelected
                    ? "border-emerald-500 text-emerald-700"
                    : "border-zinc-200 text-zinc-700 hover:border-emerald-200 hover:text-emerald-600"
                }`}
              >
                {module.name}
              </button>
            );
          })}
        </div>
        {!selectedModule ? (
          <p className="text-sm text-zinc-600">
            Seleziona un consenso per attivare le opzioni sottostanti.
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
        <PatientConsentSection
          key={selectedModuleId || "consent-empty"}
          content={selectedModule?.content ?? ""}
          doctors={doctors}
          buttonLabel="Apri informativa e firma"
          moduleLabel={selectedModule?.name ?? ""}
          disabled={!canEdit}
          hideIntro
          submitDisabled={!canSubmit}
          onSignatureChange={(value) => {
            setFormState((prev) => ({ ...prev, signatureData: value }));
            markDirty();
          }}
          onFieldChange={(fields) => {
            setFormState((prev) => ({ ...prev, ...fields }));
            markDirty();
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 font-medium text-zinc-800">
          Canale
          <select
            name="consentChannel"
            defaultValue="Di persona"
            disabled={!canEdit}
            onChange={markDirty}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-50"
          >
            {CHANNELS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 font-medium text-zinc-800">
          Scadenza (opzionale)
          <input
            type="date"
            name="consentExpiresAt"
            disabled={!canEdit}
            onChange={markDirty}
            className="h-10 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-50"
          />
        </label>
      </div>

      {showSwitchConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-zinc-900">Modifiche non salvate</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Hai modifiche non salvate per questo modulo. Se cambi modulo perderai i dati inseriti.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSwitchConfirm(false);
                  setPendingModuleId(null);
                }}
                className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingModuleId) {
                    applyModuleSwitch(pendingModuleId);
                  }
                  setShowSwitchConfirm(false);
                  setPendingModuleId(null);
                }}
                className="inline-flex h-9 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Cambia modulo
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
