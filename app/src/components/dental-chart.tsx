/* eslint-disable @next/next/no-img-element */
"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { emitToast } from "./global-toasts";
import { DictationTextarea } from "./dictation-textarea";
import { PrintLinkButton } from "./print-link-button";
import {
  formatDateInDisplayTimeZone,
  getBrowserUserDisplayTimeZone,
} from "@/lib/user-display-time-zone";

type DentalRecord = {
  id: string;
  tooth: number; // 0 means "Tutta la bocca"
  procedure: string;
  notes: string | null;
  treated?: boolean;
  performedAt: string;
  updatedAt?: string;
  updatedByName?: string | null;
};

type ToothType = "molar" | "premolar" | "canine" | "incisor";

type ToothData = {
  id: number;
  type: ToothType;
  label: string;
  x: number;
  y: number;
  rot: number;
};

const TOOTH_IMAGES: Record<ToothType, string> = {
  incisor: "/teeth/incisivi.png",
  canine: "/teeth/canini.png",
  premolar: "/teeth/premolari.png",
  molar: "/teeth/molari.png",
};

type PersistedDentalChartState = {
  isOpen?: boolean;
  selectedTooth?: number | null;
};

const TOOTH_POSITIONS: Record<number, { x: number; y: number }> = {
  11: { x: 46.4, y: 10.7 },
  12: { x: 41.8, y: 11.4 },
  13: { x: 38.6, y: 13.5 },
  14: { x: 35, y: 16 },
  15: { x: 31.8, y: 20.3 },
  16: { x: 30, y: 25.9 },
  17: { x: 28.3, y: 32.1 },
  18: { x: 27.8, y: 38.7 },
  21: { x: 51.6, y: 11.1 },
  22: { x: 56.4, y: 12 },
  23: { x: 59.7, y: 13.5 },
  24: { x: 61.7, y: 16.3 },
  25: { x: 65.1, y: 20.1 },
  26: { x: 66.5, y: 25.5 },
  27: { x: 68.5, y: 32.2 },
  28: { x: 68.9, y: 38.5 },
  31: { x: 50.5, y: 88.7 },
  32: { x: 54.1, y: 88.8 },
  33: { x: 58.1, y: 87 },
  34: { x: 62, y: 84.5 },
  35: { x: 64.5, y: 80.1 },
  36: { x: 67.1, y: 74.1 },
  37: { x: 68.2, y: 67.5 },
  38: { x: 69.1, y: 61.8 },
  41: { x: 46.4, y: 88.8 },
  42: { x: 42.1, y: 88.5 },
  43: { x: 39, y: 86.2 },
  44: { x: 35.2, y: 84.5 },
  45: { x: 30.6, y: 75.5 },
  46: { x: 30.1, y: 73.8 },
  47: { x: 28, y: 68.4 },
  48: { x: 27.5, y: 61.8 },
};

const getToothType = (toothId: number): ToothData["type"] => {
  const match = TEETH.find((t) => t.id === toothId);
  return match?.type ?? "incisor";
};

const LEGACY_PROCEDURES: Record<string, { label: string; color: string }> = {
  exam: { label: "Visita generale", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200" },
  cleaning: { label: "Ablazione tartaro", color: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" },
  filling: { label: "Otturazione", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  crown: { label: "Corona", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200" },
  rootcanal: { label: "Devitalizzazione", color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200" },
  extraction: { label: "Estrazione", color: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-200" },
  implant: { label: "Implantologia", color: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200" },
  veneer: { label: "Faccetta", color: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200" },
};

type ProcedureTint = { active: string; idle: string; tag: string };

const PROCEDURE_TINTS: ProcedureTint[] = [
  {
    active: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    idle: "bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300",
    tag: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  },
  {
    active: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
    idle: "bg-rose-50 text-rose-800 dark:bg-rose-950/20 dark:text-rose-300",
    tag: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  },
  {
    active: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
    idle: "bg-sky-50 text-sky-800 dark:bg-sky-950/20 dark:text-sky-300",
    tag: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  },
  {
    active: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200",
    idle: "bg-teal-50 text-teal-800 dark:bg-teal-950/20 dark:text-teal-300",
    tag: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200",
  },
  {
    active: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
    idle: "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/20 dark:text-indigo-300",
    tag: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
  },
  {
    active: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200",
    idle: "bg-lime-50 text-lime-800 dark:bg-lime-950/20 dark:text-lime-300",
    tag: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200",
  },
  {
    active: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
    idle: "bg-orange-50 text-orange-800 dark:bg-orange-950/20 dark:text-orange-300",
    tag: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  },
  {
    active: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200",
    idle: "bg-cyan-50 text-cyan-800 dark:bg-cyan-950/20 dark:text-cyan-300",
    tag: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200",
  },
  {
    active: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
    idle: "bg-violet-50 text-violet-800 dark:bg-violet-950/20 dark:text-violet-300",
    tag: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  },
];

const hashLabel = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const tintForLabel = (label: string) => {
  if (!PROCEDURE_TINTS.length) {
    return { active: "bg-zinc-100 text-zinc-800", idle: "bg-zinc-50 text-zinc-800", tag: "bg-zinc-100 text-zinc-800" };
  }
  const index = hashLabel(label.trim().toLowerCase()) % PROCEDURE_TINTS.length;
  return PROCEDURE_TINTS[index] ?? PROCEDURE_TINTS[0];
};

const resolveProcedure = (value: string, services: Array<{ name: string }>) => {
  const normalized = value.trim().toLowerCase();
  const match = services.find((service) => service.name.trim().toLowerCase() === normalized);
  if (match) {
    return { label: match.name, tint: tintForLabel(match.name) };
  }

  const legacy = LEGACY_PROCEDURES[normalized];
  if (legacy) {
    return { label: legacy.label, tint: tintForLabel(legacy.label) };
  }

  const legacyByLabel = Object.values(LEGACY_PROCEDURES).find(
    (p) => p.label.toLowerCase() === normalized
  );
  if (legacyByLabel) {
    return { label: legacyByLabel.label, tint: tintForLabel(legacyByLabel.label) };
  }

  return { label: value, tint: tintForLabel(value) };
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
export function DentalChart({
  patientId,
  initialRecords,
  services,
  printHref,
  defaultCollapsed = true,
  containerClassName,
}: {
  patientId: string;
  initialRecords: DentalRecord[];
  services: Array<{ id: string; name: string }>;
  printHref?: string | null;
  defaultCollapsed?: boolean;
  containerClassName?: string;
}) {
  const router = useRouter();
  const storageKey = `dental-chart:${patientId}`;
  const [displayTimeZone, setDisplayTimeZone] = useState("UTC");
  const [isMounted, setIsMounted] = useState(false);
  const [records, setRecords] = useState<DentalRecord[]>(initialRecords);
  const [isOpen, setIsOpen] = useState(!defaultCollapsed);
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [procedure, setProcedure] = useState("");
  const [notes, setNotes] = useState("");
  const [customProcedure, setCustomProcedure] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [useColorChart, setUseColorChart] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [pendingTreatedRecordIds, setPendingTreatedRecordIds] = useState<string[]>([]);
  const [isChartDialogOpen, setIsChartDialogOpen] = useState(false);

  useEffect(() => {
    setRecords(initialRecords);
  }, [initialRecords]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawState = window.sessionStorage.getItem(storageKey);
      if (!rawState) return;
      const savedState = JSON.parse(rawState) as PersistedDentalChartState;
      setIsOpen(savedState.isOpen ?? !defaultCollapsed);
      if (typeof savedState.selectedTooth === "number") {
        setSelectedTooth(savedState.selectedTooth);
      }
    } catch {
      // Ignore invalid persisted UI state.
    }
  }, [defaultCollapsed, storageKey]);

  useEffect(() => {
    setDisplayTimeZone(getBrowserUserDisplayTimeZone());
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        isOpen,
        selectedTooth,
      } satisfies PersistedDentalChartState)
    );
  }, [isOpen, selectedTooth, storageKey]);

  const recordsByTooth = useMemo(() => {
    const map = new Map<number, DentalRecord>();
    // records is sorted DESCENDING (latest first).
    // To keep the LATEST record for each tooth, we only set if not present.
    records.forEach((r) => {
      if (!map.has(r.tooth)) {
        map.set(r.tooth, r);
      }
    });
    return map;
  }, [records]);

  const toothMarkers = useMemo(() => {
    const markers: Array<{ tooth: number; treated: boolean }> = [];
    const seen = new Set<number>();
    // records is sorted DESCENDING (latest first).
    // We take the status of the LATEST record for each tooth.
    records.forEach((r) => {
      if (r.tooth !== 0 && !seen.has(r.tooth)) {
        markers.push({ tooth: r.tooth, treated: !!r.treated });
        seen.add(r.tooth);
      }
    });
    return markers;
  }, [records]);

  const sortedRecords = useMemo(
    () =>
      [...records].sort(
        (a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime()
      ),
    [records]
  );
  const sortedServices = useMemo(
    () =>
      [...services].sort((a, b) =>
        a.name.localeCompare(b.name, "it", { sensitivity: "base" })
      ),
    [services]
  );

  const selectedRecord =
    selectedTooth === null ? undefined : recordsByTooth.get(selectedTooth);
  const selectedToothData =
    selectedTooth !== null && selectedTooth !== 0
      ? TEETH.find((tooth) => tooth.id === selectedTooth) ?? null
      : null;
  const selectedToothImage = selectedToothData ? TOOTH_IMAGES[selectedToothData.type] : null;

  const hasChanges = useMemo(() => {
    if (!selectedRecord) return false;
    const currentProcedure = procedure === "altro" ? customProcedure.trim() : procedure;
    return (
      currentProcedure !== selectedRecord.procedure ||
      notes.trim() !== (selectedRecord.notes ?? "").trim()
    );
  }, [selectedRecord, procedure, customProcedure, notes]);

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

  useEffect(() => {
    if (selectedTooth === null) return;
    const record = recordsByTooth.get(selectedTooth);
    setProcedure(record?.procedure ?? "");
    setNotes(record?.notes ?? "");
  }, [recordsByTooth, selectedTooth]);

  const handleChartClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const wrapper = chartRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const clickX = ((event.clientX - rect.left) / rect.width) * 100;
    const clickY = ((event.clientY - rect.top) / rect.height) * 100;
    let closestTooth: number | null = null;
    let minDistance = Infinity;
    const threshold = 6;

    Object.entries(TOOTH_POSITIONS).forEach(([tooth, pos]) => {
      const dx = clickX - pos.x;
      const dy = clickY - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDistance) {
        minDistance = dist;
        closestTooth = Number(tooth);
      }
    });

    if (closestTooth !== null && minDistance <= threshold) {
      handleSelectTooth(closestTooth);
    }
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

      const data = (await res.json()) as {
        record: DentalRecord & { updatedBy?: { name?: string | null; email?: string | null } | null };
      };
      const normalized: DentalRecord = {
        ...data.record,
        updatedByName: data.record.updatedBy?.name ?? data.record.updatedBy?.email ?? data.record.updatedByName ?? null,
      };
      setRecords((prev) => {
        const others = prev.filter((r) => r.id !== normalized.id && r.tooth !== normalized.tooth);
        return [...others, { ...normalized, performedAt: normalized.performedAt }];
      });
      setNoteDrafts((prev) => ({
        ...prev,
        [normalized.id]: normalized.notes ?? "",
      }));
      setCustomProcedure("");
      setIsChartDialogOpen(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      emitToast("Impossibile salvare il diario clinico", "error");
    } finally {
      setIsSubmitting(false);
    }
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
        const body = (await res.json().catch(
          () => ({}) as Promise<{ error?: string }>
        )) as { error?: string };
        console.error("[dental-chart] delete failed", { status: res.status, body });
        throw new Error(body?.error || "Eliminazione non riuscita");
      }
      setRecords((prev) => prev.filter((r) => r.id !== recordId));
      if (typeof tooth === "number" && selectedTooth === tooth) {
        resetSelection();
      }
      emitToast("Record eliminato", "success");
      router.refresh();
    } catch (error) {
      console.error(error);
      emitToast("Impossibile eliminare il record", "error");
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(null);
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
      router.refresh();
    } catch (error) {
      console.error(error);
      emitToast("Impossibile salvare le note", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateRecordTreated = async (recordId: string, treated: boolean) => {
    const previousRecord = records.find((record) => record.id === recordId);
    if (!previousRecord || pendingTreatedRecordIds.includes(recordId)) {
      return;
    }

    setPendingTreatedRecordIds((prev) => [...prev, recordId]);
    setRecords((prev) =>
      prev.map((record) =>
        record.id === recordId ? { ...record, treated } : record
      )
    );

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/dental-records`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId, treated }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Salvataggio stato non riuscito");
      }
      const data = (await res.json()) as {
        record: DentalRecord & { updatedBy?: { name?: string | null; email?: string | null } | null };
      };
      const normalized: DentalRecord = {
        ...data.record,
        updatedByName: data.record.updatedBy?.name ?? data.record.updatedBy?.email ?? data.record.updatedByName ?? null,
      };
      setRecords((prev) => prev.map((r) => (r.id === normalized.id ? normalized : r)));
      emitToast("Stato aggiornato", "success");
      router.refresh();
    } catch (error) {
      setRecords((prev) =>
        prev.map((record) =>
          record.id === recordId ? { ...record, treated: previousRecord.treated } : record
        )
      );
      console.error(error);
      emitToast("Impossibile aggiornare lo stato", "error");
    } finally {
      setIsSubmitting(false);
      setPendingTreatedRecordIds((prev) => prev.filter((id) => id !== recordId));
    }
  };

  return (
    <details
      className={clsx(
        "group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm [&_summary::-webkit-details-marker]:hidden",
        containerClassName
      )}
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              router.push(`/finanza/pagamenti?patientId=${patientId}`);
            }}
            className="inline-flex h-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-3 text-[10px] font-bold uppercase tracking-wider text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:border-emerald-800 dark:hover:bg-emerald-900/40"
          >
            PAGAMENTI
          </button>
          {isOpen && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsChartDialogOpen(true);
              }}
              className="inline-flex h-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-3 text-[10px] font-bold uppercase tracking-wider text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:border-emerald-800 dark:hover:bg-emerald-900/40"
            >
              Mostra dentatura
            </button>
          )}
          {records.length > 0 ? (
            <PrintLinkButton
              href={printHref || `/pazienti/${patientId}/diario`}
              label="Stampa diario"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 transition hover:border-emerald-200 dark:hover:border-emerald-800 hover:text-emerald-700 dark:hover:text-emerald-500"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 9V4h12v5" />
                <path d="M6 18h12v2H6z" />
                <path d="M6 14h12v4H6z" />
                <path d="M4 10h16a2 2 0 0 1 2 2v3h-4" />
                <path d="M2 15h4" />
              </svg>
            </PrintLinkButton>
          ) : null}
          <svg
            className="h-5 w-5 text-zinc-600 dark:text-zinc-400 transition-transform duration-200 group-open:rotate-180"
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
        </div>
      </summary>
      <div className="p-0">
        <aside className="mx-6 my-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Pianificazioni</h3>
            <span className="rounded-full bg-white dark:bg-zinc-800 px-2 py-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
              {records.length}
            </span>
          </div>
          <div className="grid gap-4 max-h-[600px] overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
            {sortedRecords.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-300">Nessun record salvato.</p>
            ) : (
              sortedRecords.map((rec) => {
                const proc = resolveProcedure(rec.procedure, sortedServices);
                const isActive = selectedTooth === rec.tooth;
                const toothLabel = rec.tooth === 0 ? "Tutta la bocca" : `Dente ${rec.tooth}`;
                const toothImage = rec.tooth === 0 ? null : TOOTH_IMAGES[getToothType(rec.tooth)];
                const showThumbnail = rec.tooth !== 0;
                return (
                  <div
                    key={rec.id}
                    onClick={() => {
                      handleSelectTooth(rec.tooth);
                      setIsChartDialogOpen(true);
                    }}
                    className={clsx(
                      "w-full rounded-lg border px-3 py-2 text-left transition group cursor-pointer",
                      isActive
                        ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/40"
                        : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    )}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectTooth(rec.tooth);
                        setIsChartDialogOpen(true);
                      }
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {showThumbnail ? (
                        <div className="relative h-12 w-12 overflow-hidden rounded-md bg-zinc-50 dark:bg-white/5">
                          <img
                            src={toothImage ?? ""}
                            alt={toothLabel}
                            className="h-full w-full object-contain dark:brightness-110"
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-base font-semibold text-zinc-900 dark:text-zinc-100">
                            {rec.tooth}
                          </span>
                        </div>
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/40 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                          Tutta la bocca
                        </div>
                      )}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-300">
                          <span>{toothLabel}</span>
                          <span>
                            {isMounted ? formatDateInDisplayTimeZone(
                              new Date(rec.performedAt),
                              { dateStyle: "short" },
                              displayTimeZone
                            ) : null}
                          </span>
                        </div>
                        <div
                          className={clsx(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                            proc?.tint.tag ?? "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
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
                          rows={1}
                          placeholder="Aggiungi nota..."
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 py-1 text-xs text-zinc-800 dark:text-zinc-200 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900/20"
                        />
                        <div className="space-y-2 text-[11px] text-zinc-500 dark:text-zinc-300">
                          {rec.notes && rec.updatedAt ? (
                            <span className="block">
                              Aggiornato il{" "}
                              {isMounted ? formatDateInDisplayTimeZone(
                                new Date(rec.updatedAt),
                                {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                },
                                displayTimeZone
                              ) : null}
                              {rec.updatedByName ? ` da ${rec.updatedByName}` : ""}
                            </span>
                          ) : null}
                          <div className="flex items-center justify-between gap-2">
                            <label
                              className="inline-flex items-center gap-2 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(rec.treated)}
                                disabled={pendingTreatedRecordIds.includes(rec.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateRecordTreated(rec.id, e.target.checked);
                                }}
                                className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800"
                              />
                              Trattato
                            </label>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                updateRecordNote(rec.id);
                              }}
                              disabled={isSubmitting || (noteDrafts[rec.id] ?? "") === (rec.notes ?? "")}
                              className="rounded-full border border-emerald-200 dark:border-emerald-900/50 px-2 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 transition hover:border-emerald-300 dark:hover:bg-emerald-950/30 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Aggiorna nota
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end opacity-0 transition group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowDeleteConfirm(rec.id);
                          }}
                          className="rounded-full border border-rose-200 dark:border-rose-900/50 px-2 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300 transition hover:bg-rose-50 dark:hover:bg-rose-950/30"
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

      {isChartDialogOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-zinc-50 shadow-2xl dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
                    <path d="M9 2v4" /><path d="M15 2v4" /><path d="M7 10h10" /><path d="M7 14h6" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">DENTATURA & PROCEDURE</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Seleziona dente o tutta la bocca</p>
                </div>
              </div>
              <button
                onClick={() => setIsChartDialogOpen(false)}
                className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr,340px]">
                <section className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="mb-6 flex flex-wrap items-center gap-4 text-xs">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">LEGENDA</span>
                    <div className="flex gap-3">
                      <span className="inline-flex items-center gap-2 rounded-full bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 border border-zinc-100 dark:border-zinc-800">
                        <svg width="12" height="12" viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" fill="none" stroke="#22c55e" strokeWidth="10" /></svg>
                        <span className="font-bold text-zinc-700 dark:text-zinc-300 uppercase">TRATTATO</span>
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 border border-zinc-100 dark:border-zinc-800">
                        <svg width="12" height="12" viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" fill="none" stroke="#ef4444" strokeWidth="10" /></svg>
                        <span className="font-bold text-zinc-700 dark:text-zinc-300 uppercase">SELEZIONATO</span>
                      </span>
                    </div>
                  </div>

                  <div
                    ref={chartRef}
                    onClick={handleChartClick}
                    className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-100 bg-white dark:border-zinc-800 dark:bg-zinc-950 shadow-inner cursor-pointer"
                  >
                    <img
                      src={useColorChart ? "/teeth/mouth_color.png" : "/teeth/mouth_white.png"}
                      alt="Arcata dentale"
                      className="block h-auto w-full select-none dark:brightness-75"
                      draggable={false}
                    />
                    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {toothMarkers.filter((m) => TOOTH_POSITIONS[m.tooth]).map((m) => (
                        <circle key={`marker-${m.tooth}`} cx={TOOTH_POSITIONS[m.tooth].x} cy={TOOTH_POSITIONS[m.tooth].y} r="3.5" fill="none" stroke={m.treated ? "#22c55e" : "#f59e0b"} strokeWidth="0.6" />
                      ))}
                      {selectedTooth !== null && selectedTooth !== 0 && TOOTH_POSITIONS[selectedTooth] && (
                        <>
                          <circle cx={TOOTH_POSITIONS[selectedTooth].x} cy={TOOTH_POSITIONS[selectedTooth].y} r="3.7" fill="none" stroke="#ef4444" strokeWidth="0.6" />
                          <circle cx={TOOTH_POSITIONS[selectedTooth].x} cy={TOOTH_POSITIONS[selectedTooth].y} r="1.1" fill="#ef4444" />
                        </>
                      )}
                    </svg>
                    <div className="absolute bottom-4 left-4 rounded-full bg-white/90 dark:bg-zinc-900 px-3 py-2 text-[11px] font-bold shadow-sm border border-zinc-200 dark:border-zinc-800">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="h-4 w-4 rounded border-zinc-300 dark:bg-zinc-800" checked={useColorChart} onChange={(e) => setUseColorChart(e.target.checked)} onClick={(e) => e.stopPropagation()} />
                        Colori
                      </label>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleSelectTooth(0)}
                      className={clsx(
                        "rounded-full border px-6 py-2 text-sm font-bold transition-all",
                        selectedTooth === 0
                          ? "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-200"
                          : "border-zinc-200 bg-white text-zinc-700 hover:border-emerald-300"
                      )}
                    >
                      Tutta la bocca
                    </button>
                  </div>
                </section>

                <aside className="flex flex-col gap-6">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    {selectedToothData ? (
                      <div className="mb-6 flex items-center gap-4 rounded-xl bg-emerald-50/50 p-3 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30">
                        <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-white shadow-sm dark:bg-zinc-800">
                          <img src={selectedToothImage ?? ""} alt={`Dente ${selectedToothData.id}`} className="h-full w-full object-contain" />
                          <span className="absolute inset-0 flex items-center justify-center text-xl font-black text-zinc-900 dark:text-zinc-100">{selectedToothData.id}</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Dente Selezionato</p>
                          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Dente {selectedToothData.id}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-6 rounded-xl bg-zinc-50 p-4 text-center dark:bg-zinc-800/50 border border-dashed border-zinc-200 dark:border-zinc-700">
                        <p className="text-sm font-bold text-zinc-500 italic">Seleziona un dente dal diagramma</p>
                      </div>
                    )}

                    <div className={clsx("space-y-5", selectedTooth === null && "opacity-40 pointer-events-none")}>
                      <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-zinc-400">Procedura</label>
                        <div className="grid grid-cols-2 gap-2">
                          {sortedServices.map((service) => {
                            const tint = tintForLabel(service.name);
                            return (
                              <button key={service.id} type="button" onClick={() => setProcedure(service.name)}
                                className={clsx("rounded-lg border px-3 py-2 text-left text-xs font-bold transition-all",
                                  procedure === service.name ? `border-emerald-500 ring-2 ring-emerald-100 ${tint.active}` : `border-zinc-100 bg-zinc-50/50 ${tint.idle} hover:border-emerald-200`
                                )}>
                                {service.name}
                              </button>
                            );
                          })}
                          <button type="button" onClick={() => setProcedure("altro")}
                            className={clsx("rounded-lg border px-3 py-2 text-left text-xs font-bold transition-all",
                              procedure === "altro" ? "border-emerald-500 ring-2 ring-emerald-100 bg-white text-zinc-900" : "border-zinc-100 bg-zinc-50/50 hover:border-emerald-200"
                            )}>
                            Altro...
                          </button>
                        </div>
                      </div>

                      {procedure === "altro" && (
                        <input value={customProcedure} onChange={(e) => setCustomProcedure(e.target.value)}
                          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-100"
                          placeholder="Specifica procedura..." />
                      )}

                      <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-zinc-400">Note Cliniche</label>
                        <DictationTextarea value={notes} onChange={(e) => setNotes(e.target.value)} onValueChange={setNotes}
                          placeholder="Materiali, superfici..."
                          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-100" />
                      </div>

                      <button type="button" onClick={handleSave}
                        disabled={selectedTooth === null || !procedure || isSubmitting || (!!selectedRecord && !hasChanges)}
                        className="w-full rounded-xl bg-emerald-600 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700 disabled:opacity-40">
                        {selectedRecord ? "Aggiorna" : "Salva nel Diario"}
                      </button>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-950">
            <div className="mb-3 text-center text-lg font-semibold text-rose-700 dark:text-rose-400">
              Conferma eliminazione
            </div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Sei sicuro di voler eliminare definitivamente questo record dal diario clinico?
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(null)}
                className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  const rec = records.find((r) => r.id === showDeleteConfirm);
                  if (rec) deleteRecord(rec.id, rec.tooth);
                }}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200 dark:focus:ring-rose-900"
              >
                {isSubmitting ? "Eliminazione..." : "Conferma"}
              </button>
            </div>
          </div>
        </div>
      )}
    </details>
  );
}
