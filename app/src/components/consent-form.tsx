"use client";

import { useMemo, useRef, useState } from "react";
import { addConsentAction } from "@/app/_actions/consent";
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
  patientId: string;
  modules: ConsentModule[];
  doctors: { id: string; fullName: string }[];
  consents: {
    id: string;
    moduleId: string;
    status: string;
    channel?: string | null;
    givenAt: string | Date;
    signatureUrl?: string | null;
    module?: { name?: string | null } | null;
  }[];
  revokeAction: (formData: FormData) => Promise<void>;
};

const CHANNELS = ["Di persona", "Telefono", "Manuale", "Digitale"];
const DEFAULT_PLACE = "Striano";
const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const getTodayDateKey = () => DATE_FORMATTER.format(new Date());

export function ConsentForm({ patientId, modules, doctors, consents, revokeAction }: Props) {
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");
  const [formState, setFormState] = useState({
    place: DEFAULT_PLACE,
    date: getTodayDateKey(),
    patientName: "",
    doctorName: "",
    signatureData: "",
  });
  const [dirty, setDirty] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const revokeSubmitRef = useRef<HTMLButtonElement | null>(null);
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);
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
  const selectedConsent = useMemo(
    () => consents.find((consent) => consent.moduleId === selectedModuleId) ?? null,
    [consents, selectedModuleId],
  );
  const consentByModule = useMemo(() => {
    const map = new Map<string, Props["consents"][number]>();
    consents.forEach((consent) => {
      map.set(consent.moduleId, consent);
    });
    return map;
  }, [consents]);
  const canEdit = Boolean(selectedModule) && (!selectedConsent || selectedConsent.status === "REVOKED");
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
      place: DEFAULT_PLACE,
      date: getTodayDateKey(),
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
    <form
      action={addConsentAction}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-800"
    >
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="consentModuleId" value={selectedModuleId} />

      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orderedModules.map((module) => {
            const isSelected = module.id === selectedModuleId;
            const consent = consentByModule.get(module.id);
            const isActiveConsent = consent && consent.status !== "REVOKED";
            const statusClass = isActiveConsent
              ? "border-sky-300 bg-sky-50 text-sky-800"
              : module.required
                ? "border-rose-300 bg-rose-50 text-rose-800"
                : "border-amber-300 bg-amber-50 text-amber-800";
            return (
              <div key={module.id} className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleModuleSelect(module.id)}
                  className={`flex min-h-[120px] items-center justify-center rounded-xl border-2 px-4 text-center text-base font-semibold transition ${statusClass} ${
                    isSelected ? "ring-2 ring-emerald-400" : "hover:brightness-95"
                  }`}
                >
                  {module.name}
                </button>
                {isActiveConsent ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPendingRevokeId(consent.id);
                      setShowRevokeConfirm(true);
                    }}
                    className="inline-flex h-9 items-center justify-center rounded-full border border-rose-200 px-4 text-xs font-semibold text-rose-700 transition hover:border-rose-300"
                  >
                    Revoca
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        {!selectedModule ? (
          <p className="text-sm text-zinc-600">
            Seleziona un consenso per attivare le opzioni sottostanti.
          </p>
        ) : null}
      </div>

      <input type="hidden" name="consentId" value={pendingRevokeId ?? ""} />
      <button
        type="submit"
        formAction={revokeAction}
        formNoValidate
        ref={revokeSubmitRef}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      >
        Conferma revoca
      </button>

      {canEdit ? (
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
            markRequired={Boolean(selectedModule?.required)}
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
      ) : null}

      {canEdit ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 font-medium text-zinc-800">
          Consenso ottenuto via...
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
      ) : null}

      {showRevokeConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-zinc-900">Conferma revoca</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Vuoi revocare questo consenso? L&apos;azione può essere annullata creando un nuovo consenso.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRevokeConfirm(false);
                  setPendingRevokeId(null);
                }}
                className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRevokeConfirm(false);
                  revokeSubmitRef.current?.click();
                  setPendingRevokeId(null);
                }}
                className="inline-flex h-9 items-center justify-center rounded-full bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500"
              >
                Revoca
              </button>
            </div>
          </div>
        </div>
      ) : null}

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

    </form>
  );
}
