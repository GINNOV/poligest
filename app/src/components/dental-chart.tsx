"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { emitToast } from "./global-toasts";

type DentalRecord = {
  id: string;
  tooth: number; // 0 means "Tutta la bocca"
  procedure: string;
  notes: string | null;
  performedAt: string;
  updatedAt?: string;
  updatedByName?: string | null;
};

const TOOTH_PATHS: Record<string, string> = {
  molar:
    "M10,2 C5,2 2,5 2,12 C2,18 5,22 10,22 C15,22 18,18 18,12 C18,5 15,2 10,2 Z M6,8 C6,7 7,6 8,6 C9,6 10,7 10,8 C10,7 11,6 12,6 C13,6 14,7 14,8 M5,12 L15,12",
  premolar:
    "M10,2 C6,2 3,5 3,12 C3,18 6,22 10,22 C14,22 17,18 17,12 C17,5 14,2 10,2 Z M7,8 C7,7 8,6 9,6 C10,6 11,7 11,8 C11,7 12,6 13,6 M5,12 L15,12",
  canine: "M10,2 C7,2 4,6 4,12 C4,18 7,22 10,22 C13,22 16,18 16,12 C16,6 13,2 10,2 Z M10,6 L10,16",
  incisor: "M10,4 C7,4 5,6 5,12 C5,18 7,22 10,22 C13,22 15,18 15,12 C15,6 13,4 10,4 Z M8,8 L12,8",
};

type ToothData = {
  id: number;
  type: keyof typeof TOOTH_PATHS;
  label: string;
  x: number;
  y: number;
  rot: number;
};

const TOOTH_IMAGES: Record<ToothData["type"], string> = {
  incisor: "/teeth/incisivi.jpg",
  canine: "/teeth/canini.jpg",
  premolar: "/teeth/premolari.jpg",
  molar: "/teeth/molari.jpg",
};

const getToothType = (toothId: number): ToothData["type"] => {
  const match = TEETH.find((t) => t.id === toothId);
  return match?.type ?? "incisor";
};

const LEGACY_PROCEDURES: Record<string, { label: string; color: string }> = {
  exam: { label: "Visita generale", color: "bg-blue-100 text-blue-800" },
  cleaning: { label: "Ablazione tartaro", color: "bg-sky-100 text-sky-800" },
  filling: { label: "Otturazione", color: "bg-amber-100 text-amber-800" },
  crown: { label: "Corona", color: "bg-purple-100 text-purple-800" },
  rootcanal: { label: "Devitalizzazione", color: "bg-red-100 text-red-800" },
  extraction: { label: "Estrazione", color: "bg-slate-100 text-slate-800" },
  implant: { label: "Implantologia", color: "bg-teal-100 text-teal-800" },
  veneer: { label: "Faccetta", color: "bg-pink-100 text-pink-800" },
};

const resolveProcedure = (value: string) => {
  const normalized = value.trim().toLowerCase();
  const byId = PROCEDURES.find((p) => p.id === normalized);
  if (byId) return byId;

  const byLabel = PROCEDURES.find((p) => p.label.toLowerCase() === normalized);
  if (byLabel) return byLabel;

  const legacy = LEGACY_PROCEDURES[normalized];
  if (legacy) return legacy;

  const legacyByLabel = Object.values(LEGACY_PROCEDURES).find(
    (p) => p.label.toLowerCase() === normalized
  );
  if (legacyByLabel) return legacyByLabel;

  return { label: value, color: "bg-zinc-100 text-zinc-800" };
};

const TEETH: ToothData[] = [
  { id: 18, type: "molar", label: "18", x: 20, y: 140, rot: -20 },
  { id: 17, type: "molar", label: "17", x: 35, y: 110, rot: -15 },
  { id: 16, type: "molar", label: "16", x: 55, y: 85, rot: -10 },
  { id: 15, type: "premolar", label: "15", x: 80, y: 65, rot: -5 },
  { id: 14, type: "premolar", label: "14", x: 105, y: 50, rot: 0 },
  { id: 13, type: "canine", label: "13", x: 135, y: 40, rot: 5 },
  { id: 12, type: "incisor", label: "12", x: 165, y: 35, rot: 5 },
  { id: 11, type: "incisor", label: "11", x: 195, y: 35, rot: 0 },
  { id: 21, type: "incisor", label: "21", x: 225, y: 35, rot: 0 },
  { id: 22, type: "incisor", label: "22", x: 255, y: 35, rot: -5 },
  { id: 23, type: "canine", label: "23", x: 285, y: 40, rot: -5 },
  { id: 24, type: "premolar", label: "24", x: 315, y: 50, rot: 0 },
  { id: 25, type: "premolar", label: "25", x: 340, y: 65, rot: 5 },
  { id: 26, type: "molar", label: "26", x: 365, y: 85, rot: 10 },
  { id: 27, type: "molar", label: "27", x: 385, y: 110, rot: 15 },
  { id: 28, type: "molar", label: "28", x: 400, y: 140, rot: 20 },
  { id: 48, type: "molar", label: "48", x: 20, y: 360, rot: 20 },
  { id: 47, type: "molar", label: "47", x: 35, y: 390, rot: 15 },
  { id: 46, type: "molar", label: "46", x: 55, y: 415, rot: 10 },
  { id: 45, type: "premolar", label: "45", x: 80, y: 435, rot: 5 },
  { id: 44, type: "premolar", label: "44", x: 105, y: 450, rot: 0 },
  { id: 43, type: "canine", label: "43", x: 135, y: 460, rot: -5 },
  { id: 42, type: "incisor", label: "42", x: 165, y: 465, rot: -5 },
  { id: 41, type: "incisor", label: "41", x: 195, y: 465, rot: 0 },
  { id: 31, type: "incisor", label: "31", x: 225, y: 465, rot: 0 },
  { id: 32, type: "incisor", label: "32", x: 255, y: 465, rot: 5 },
  { id: 33, type: "canine", label: "33", x: 285, y: 460, rot: 5 },
  { id: 34, type: "premolar", label: "34", x: 315, y: 450, rot: 0 },
  { id: 35, type: "premolar", label: "35", x: 340, y: 435, rot: -5 },
  { id: 36, type: "molar", label: "36", x: 365, y: 415, rot: -10 },
  { id: 37, type: "molar", label: "37", x: 385, y: 390, rot: -15 },
  { id: 38, type: "molar", label: "38", x: 400, y: 360, rot: -20 },
];

const PROCEDURES = [
  { id: "otturazione", label: "Otturazione", color: "bg-amber-100 text-amber-800" },
  { id: "devitalizzazione", label: "Devitalizzazione", color: "bg-red-100 text-red-800" },
  { id: "estrazione", label: "Estrazione", color: "bg-slate-100 text-slate-800" },
  { id: "estrazione-chirurgica", label: "Estrazione chirurgica", color: "bg-slate-200 text-slate-900" },
  { id: "ablazione-tartaro", label: "Ablazione tartaro", color: "bg-sky-100 text-sky-800" },
  { id: "implantologia", label: "Implantologia", color: "bg-teal-100 text-teal-800" },
  { id: "protesi-mobile", label: "Protesi mobile", color: "bg-purple-100 text-purple-800" },
  { id: "protesi-fissa", label: "Protesi fissa", color: "bg-indigo-100 text-indigo-800" },
];

function Tooth({
  data,
  isSelected,
  hasRecord,
  onClick,
}: {
  data: ToothData;
  isSelected: boolean;
  hasRecord: boolean;
  onClick: (id: number) => void;
}) {
  const path = TOOTH_PATHS[data.type];

  const stroke = hasRecord ? "#22c55e" : "transparent";
  const strokeWidth = stroke === "transparent" ? 0 : 2;

  // Ease compression between arches (looks less squished) and lift everything upward to use top space.
  const yScaled = 140 + (data.y - 210) * 0.6;
  const xShifted = data.x - 80; // nudge entire mouth further left to keep right side visible

  return (
    <g
      transform={`translate(${xShifted}, ${yScaled}) rotate(${data.rot}) scale(1.45)`}
      onClick={(e) => {
        e.stopPropagation();
        onClick(data.id);
      }}
      className="cursor-pointer transition-opacity hover:opacity-80"
    >
      {isSelected && (
        <circle
          cx="10"
          cy="12"
          r="14.4"
          fill="none"
          stroke="#ef4444"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <defs>
        <pattern
          id={`tooth-img-${data.id}`}
          patternUnits="userSpaceOnUse"
          width="24"
          height="26"
        >
          <image
            href={TOOTH_IMAGES[data.type]}
            x="0"
            y="0"
            width="24"
            height="26"
            preserveAspectRatio="xMidYMid meet"
          />
        </pattern>
      </defs>
      <path
        d={path}
        fill={`url(#tooth-img-${data.id})`}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <text
        x="10"
        y="12"
        fontSize="6"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={isSelected ? "#0f172a" : "#1f2937"}
        className="pointer-events-none select-none font-semibold"
      >
        {data.label}
      </text>
    </g>
  );
}

export function DentalChart({
  patientId,
  initialRecords,
  defaultCollapsed = true,
  containerClassName,
}: {
  patientId: string;
  initialRecords: DentalRecord[];
  defaultCollapsed?: boolean;
  containerClassName?: string;
}) {
  const [records, setRecords] = useState<DentalRecord[]>(initialRecords);
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [procedure, setProcedure] = useState("");
  const [notes, setNotes] = useState("");
  const [customProcedure, setCustomProcedure] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setNoteDrafts((prev) => {
      const next = { ...prev };
      records.forEach((record) => {
        if (next[record.id] === undefined) {
          next[record.id] = record.notes ?? "";
        }
      });
      return next;
    });
  }, [records]);

  const recordsByTooth = useMemo(() => {
    const map = new Map<number, DentalRecord>();
    records.forEach((r) => map.set(r.tooth, r));
    return map;
  }, [records]);

  const sortedRecords = useMemo(
    () =>
      [...records].sort(
        (a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime()
      ),
    [records]
  );

  const selectedRecord =
    selectedTooth === null ? undefined : recordsByTooth.get(selectedTooth);

  const resetSelection = () => {
    setSelectedTooth(null);
    setProcedure("");
    setNotes("");
  };

  const handleSelectTooth = (id: number) => {
    setSelectedTooth(id);
    const record = recordsByTooth.get(id);
    setProcedure(record?.procedure ?? "");
    setNotes(record?.notes ?? "");
  };

  const handleSave = async () => {
    const chosenProcedure = procedure === "altro" ? customProcedure.trim() : procedure;
    if (selectedTooth === null || !chosenProcedure) {
      emitToast("Seleziona un dente (o tutta la bocca) e una procedura", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/dental-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tooth: selectedTooth, procedure: chosenProcedure, notes }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Salvataggio non riuscito");
      }

      const data = (await res.json()) as { record: DentalRecord };
      setRecords((prev) => {
        const others = prev.filter((r) => r.id !== data.record.id && r.tooth !== data.record.tooth);
        return [...others, { ...data.record, performedAt: data.record.performedAt }];
      });
      setNoteDrafts((prev) => ({
        ...prev,
        [data.record.id]: data.record.notes ?? "",
      }));
      setCustomProcedure("");
    } catch (error) {
      console.error(error);
      emitToast("Impossibile salvare il diario clinico", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRecord) return;
    await deleteRecord(selectedRecord.id, selectedTooth ?? undefined);
  };

  const deleteRecord = async (recordId: string, tooth?: number) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/dental-records?recordId=${encodeURIComponent(recordId)}`, {
        method: "DELETE",
        // Some proxies strip DELETE bodies; send JSON for our handler but keep query param too.
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId }),
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as any));
        console.error("[dental-chart] delete failed", { status: res.status, body });
        throw new Error(body?.error || "Eliminazione non riuscita");
      }
      setRecords((prev) => prev.filter((r) => r.id !== recordId));
      if (typeof tooth === "number" && selectedTooth === tooth) {
        resetSelection();
      }
      emitToast("Record eliminato", "success");
    } catch (error) {
      console.error(error);
      emitToast("Impossibile eliminare il record", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateRecordNote = async (recordId: string) => {
    const draft = noteDrafts[recordId] ?? "";
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/dental-records`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId, notes: draft }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Salvataggio note non riuscito");
      }
      const data = (await res.json()) as {
        record: DentalRecord & { updatedBy?: { name?: string | null; email?: string | null } | null };
      };
      const normalized: DentalRecord = {
        ...data.record,
        updatedByName: data.record.updatedBy?.name ?? data.record.updatedBy?.email ?? data.record.updatedByName ?? null,
      };
      setRecords((prev) => prev.map((r) => (r.id === normalized.id ? normalized : r)));
      setNoteDrafts((prev) => ({ ...prev, [recordId]: normalized.notes ?? "" }));
      emitToast("Note aggiornate", "success");
    } catch (error) {
      console.error(error);
      emitToast("Impossibile salvare le note", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <details
      className={clsx(
        "group rounded-2xl border border-zinc-200 bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden",
        containerClassName
      )}
      open={!defaultCollapsed}
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 border-b border-zinc-200 px-6 py-4 text-base font-semibold text-zinc-900">
        <span className="flex items-center gap-3">
          <svg
            className="h-8 w-8 text-emerald-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
            <path d="M9 2v4" />
            <path d="M15 2v4" />
            <path d="M7 10h10" />
            <path d="M7 14h6" />
          </svg>
          <span className="uppercase tracking-wide">Diario clinico</span>
        </span>
        <svg
          className="h-5 w-5 text-zinc-600 transition-transform duration-200 group-open:rotate-180"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="p-0">
        <div className="px-6 pt-2 text-sm text-zinc-600">
          Seleziona un dente o “Tutta la bocca” per registrare una procedura.
        </div>
    <div className="rounded-2xl bg-white">
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Arcata dentale (FDI 2 cifre)</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-800">
            Seleziona dente e salva procedura
          </span>
          <button
            type="button"
            onClick={() => handleSelectTooth(0)}
            className={clsx(
              "rounded-full border px-3 py-1 text-[11px] font-semibold transition",
              selectedTooth === 0
                ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                : "border-zinc-200 bg-white text-zinc-700 hover:border-emerald-200 hover:text-emerald-700"
            )}
          >
            Tutta la bocca
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[1fr,280px]">
        <section className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-zinc-600">
            {[
              {
                label: "Sano",
                render: (
                  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
                    <path d={TOOTH_PATHS.incisor} fill="#fff" stroke="#d4d4d8" strokeWidth="1.5" />
                  </svg>
                ),
              },
              {
                label: "Trattato",
                render: (
                  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
                    <path d={TOOTH_PATHS.incisor} fill="#ecfeff" stroke="#22c55e" strokeWidth="2" />
                  </svg>
                ),
              },
              {
                label: "Selezionato",
                render: (
                  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
                    <circle cx="12" cy="12" r="10" fill="none" stroke="#ef4444" strokeWidth="2.5" />
                    <path d={TOOTH_PATHS.incisor} fill="#fff" stroke="#d4d4d8" strokeWidth="1.2" />
                  </svg>
                ),
              },
            ].map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1.5"
              >
                {item.render}
                <span className="font-semibold text-zinc-700">{item.label}</span>
              </span>
            ))}
          </div>
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-inner">
            <div className="relative h-full w-full">
              <svg viewBox="-80 0 440 340" className="h-full w-full">
                <line x1="140" y1="0" x2="140" y2="340" stroke="#e4e4e7" strokeWidth="2" />
                <line x1="-80" y1="170" x2="360" y2="170" stroke="#e4e4e7" strokeWidth="2" />
                {TEETH.map((tooth) => (
                  <Tooth
                    key={tooth.id}
                    data={tooth}
                    isSelected={selectedTooth === tooth.id}
                    hasRecord={Boolean(recordsByTooth.get(tooth.id))}
                    onClick={handleSelectTooth}
                  />
                ))}
              </svg>
            </div>
          </div>
        </section>

        <aside className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                {selectedTooth === null
                  ? "Nessun dente selezionato"
                  : selectedTooth === 0
                    ? "Tutta la bocca"
                    : `Dente ${selectedTooth}`}
              </p>
              <h3 className="text-lg font-semibold text-zinc-900">Procedura</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Cosa e&apos; eseguito al dente selezionato?
              </p>
            </div>
            {selectedTooth !== null && (
              <button
                onClick={resetSelection}
                className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-semibold text-zinc-700 transition hover:border-zinc-300"
              >
                Deseleziona
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {PROCEDURES.map((proc) => (
                <button
                  key={proc.id}
                  type="button"
                  onClick={() => setProcedure(proc.id)}
                  className={clsx(
                    "rounded-lg border px-3 py-2 text-left text-sm font-medium transition",
                    procedure === proc.id
                      ? `border-emerald-500 ring-2 ring-emerald-100 ${proc.color}`
                      : "border-zinc-200 bg-zinc-50 hover:border-emerald-200 hover:bg-white text-zinc-700"
                  )}
                >
                  {proc.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setProcedure("altro")}
                className={clsx(
                  "rounded-lg border px-3 py-2 text-left text-sm font-medium transition",
                  procedure === "altro"
                    ? "border-emerald-500 ring-2 ring-emerald-100 bg-white text-zinc-900"
                    : "border-zinc-200 bg-zinc-50 hover:border-emerald-200 hover:bg-white text-zinc-700"
                )}
              >
                Altro
              </button>
            </div>

            {procedure === "altro" && (
              <label className="block text-sm font-medium text-zinc-800">
                Procedura personalizzata
                <input
                  value={customProcedure}
                  onChange={(e) => setCustomProcedure(e.target.value)}
                  className="mt-1 h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Descrizione procedura"
                />
              </label>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-800">Note cliniche</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Materiali, superfici, complicanze..."
                className="mt-1 h-28 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={selectedTooth === null || !procedure || isSubmitting}
              className="flex-1 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {selectedRecord ? "Aggiorna questa procedura" : "Aggiungi al diario"}
            </button>
            {selectedRecord ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="rounded-lg border border-rose-200 px-3 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Rimuovi
              </button>
            ) : null}
          </div>
        </aside>
      </div>

      <aside className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 shadow-sm">
        <div className="flex items-center justify-between pb-2">
          <h3 className="text-sm font-semibold text-zinc-900">Pianificazioni</h3>
          <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700">
            {records.length}
          </span>
        </div>
        <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
          {sortedRecords.length === 0 ? (
            <p className="text-xs text-zinc-500">Nessun record. Seleziona un dente.</p>
          ) : (
            sortedRecords.map((rec) => {
              const proc = resolveProcedure(rec.procedure);
              const isActive = selectedTooth === rec.tooth;
              const toothLabel = rec.tooth === 0 ? "Tutta la bocca" : `Dente ${rec.tooth}`;
              const toothImage = rec.tooth === 0 ? null : TOOTH_IMAGES[getToothType(rec.tooth)];
              const showThumbnail = rec.tooth !== 0;
              return (
                <div
                  key={rec.id}
                  onClick={() => handleSelectTooth(rec.tooth)}
                  className={clsx(
                    "w-full rounded-lg border px-3 py-2 text-left transition group cursor-pointer",
                    isActive
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-zinc-200 bg-white hover:bg-zinc-50"
                  )}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectTooth(rec.tooth);
                    }
                  }}
                >
                  <div className="flex items-center gap-4">
                    {showThumbnail ? (
                      <div className="relative h-12 w-12 overflow-hidden">
                        <img
                          src={toothImage ?? ""}
                          alt={toothLabel}
                          className="h-full w-full object-contain"
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-base font-semibold text-zinc-900">
                          {rec.tooth}
                        </span>
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-[11px] font-semibold text-emerald-800">
                        Tutta la bocca
                      </div>
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between text-sm text-zinc-600">
                        <span>{toothLabel}</span>
                        <span>{new Date(rec.performedAt).toLocaleDateString("it-IT")}</span>
                      </div>
                      <div
                        className={clsx(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          proc?.color ?? "bg-zinc-100 text-zinc-800"
                        )}
                      >
                        {proc?.label ?? rec.procedure}
                      </div>
                    </div>
                  </div>
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={noteDrafts[rec.id] ?? ""}
                        onChange={(e) =>
                          setNoteDrafts((prev) => ({ ...prev, [rec.id]: e.target.value }))
                        }
                        rows={2}
                        placeholder="Aggiungi nota..."
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="w-full rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      />
                      <div className="flex items-center justify-between text-[11px] text-zinc-500">
                        {rec.notes && rec.updatedAt ? (
                          <span>
                            Aggiornato il{" "}
                            {new Date(rec.updatedAt).toLocaleString("it-IT", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                            {rec.updatedByName ? ` da ${rec.updatedByName}` : ""}
                          </span>
                        ) : (
                          <span />
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            updateRecordNote(rec.id);
                          }}
                          disabled={isSubmitting || (noteDrafts[rec.id] ?? "") === (rec.notes ?? "")}
                          className="rounded-full border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-800 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Salva nota
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        deleteRecord(rec.id, rec.tooth);
                      }}
                      className="rounded-full border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50"
                      disabled={isSubmitting}
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
      </div>
    </details>
  );
}
