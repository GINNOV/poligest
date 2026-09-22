"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Role } from "@prisma/client";
import { pickBestInstruction } from "@/lib/instructions/match";
import { StepMarkdown } from "@/lib/instructions/markdown";
import {
  clearProgress,
  currentStepIndex,
  loadProgress,
  reconcileProgress,
  saveProgress,
} from "@/lib/instructions/progress";
import { extractYoutubeVideoId, youtubeEmbedUrl } from "@/lib/instructions/youtube";

export type Step = {
  id: string;
  title: string;
  content: string;
  youtubeUrl?: string | null;
  sortOrder: number;
};

export type Instruction = {
  id: string;
  title: string;
  description?: string | null;
  pathPattern: string;
  role: Role | null;
  isActive: boolean;
  sortOrder?: number;
  updatedAt?: Date | string;
  category?: string | null;
  steps: Step[];
};

type Props = {
  instructions: Instruction[];
  userRole: Role;
  userId: string;
};

function StepYoutubeEmbed({ url }: { readonly url?: string | null }) {
  const videoId = url ? extractYoutubeVideoId(url) : null;
  if (!videoId) return null;

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="relative h-36 w-full sm:h-40">
        <iframe
          title="Video di supporto YouTube"
          src={youtubeEmbedUrl(videoId)}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}

function InstructionPanel({
  instruction,
  userId,
  onClose,
}: {
  instruction: Instruction;
  userId: string;
  onClose: () => void;
}) {
  const orderedIds = useMemo(() => instruction.steps.map((s) => s.id), [instruction.steps]);
  const [completedIds, setCompletedIds] = useState<string[]>(() =>
    reconcileProgress(loadProgress(userId, instruction.id).completedStepIds, orderedIds),
  );
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentStepRef = useRef<HTMLLIElement>(null);
  const syncKey = `${userId}:${instruction.id}:${orderedIds.join(",")}`;
  const [seenKey, setSeenKey] = useState(syncKey);
  if (seenKey !== syncKey) {
    setSeenKey(syncKey);
    setCompletedIds(
      reconcileProgress(loadProgress(userId, instruction.id).completedStepIds, orderedIds),
    );
    setCollapsed(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stepIndex = currentStepIndex(orderedIds, completedIds);
  const total = instruction.steps.length;
  const allDone = total > 0 && stepIndex >= total;
  const current = !allDone ? instruction.steps[stepIndex] : null;

  useEffect(() => {
    if (collapsed) return;
    const frame = window.requestAnimationFrame(() => {
      currentStepRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [stepIndex, collapsed, instruction.id]);

  function persist(ids: string[]) {
    setCompletedIds(ids);
    saveProgress(userId, instruction.id, ids);
  }

  function markComplete() {
    if (!current || completedIds.includes(current.id)) return;
    persist([...completedIds, current.id]);
  }

  function restart() {
    clearProgress(userId, instruction.id);
    setCompletedIds([]);
    setCollapsed(false);
    scrollRef.current?.scrollTo({ top: 0 });
  }

  if (typeof document === "undefined") return null;

  if (collapsed) {
    return createPortal(
      <div
        className="fixed bottom-4 right-4 z-50 max-w-[min(100vw-2rem,22rem)] text-zinc-800 dark:text-zinc-100"
        role="dialog"
        aria-modal="false"
        aria-label={instruction.title}
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex w-full items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-lg ring-1 ring-black/5 transition hover:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-white/10"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-50 text-sm text-zinc-900 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-50 dark:ring-zinc-800">
            ?
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {instruction.title}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {allDone ? "Completata" : `Passaggio ${Math.min(stepIndex + 1, total)}/${total}`}
            </span>
          </span>
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Espandi</span>
        </button>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      className="fixed bottom-4 right-4 z-50 flex w-[min(100vw-2rem,24rem)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-800 shadow-xl ring-1 ring-black/5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-white/10"
      style={{ maxHeight: "calc(100dvh - 2rem)" }}
      role="dialog"
      aria-modal="false"
      aria-labelledby="instruction-panel-title"
    >
      <div className="flex shrink-0 items-start gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-50 text-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          🧭
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="instruction-panel-title" className="text-lg leading-tight font-semibold text-zinc-900 dark:text-zinc-50">
            {instruction.title}
          </h2>
          {instruction.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-zinc-500 dark:text-zinc-400">
              {instruction.description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          aria-label="Chiudi"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <ol className="relative">
          {instruction.steps.map((step, index) => {
            const done = completedIds.includes(step.id);
            const isCurrent = !allDone && index === stepIndex;
            const isFuture = !done && !isCurrent;
            return (
              <li
                key={step.id}
                ref={isCurrent ? currentStepRef : undefined}
                className={`relative flex gap-3 pb-5 transition-[filter,opacity] duration-200 last:pb-0 ${
                  isFuture ? "pointer-events-none select-none opacity-40 blur-[1.5px]" : ""
                }`}
                aria-current={isCurrent ? "step" : undefined}
              >
                {index < instruction.steps.length - 1 ? (
                  <span
                    className={`absolute top-8 bottom-0 left-[15px] w-0.5 ${
                      done ? "bg-emerald-600" : "bg-zinc-200 dark:bg-zinc-800"
                    }`}
                    aria-hidden
                  />
                ) : null}
                <span
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    done
                      ? "bg-emerald-600 text-white"
                      : isCurrent
                        ? "bg-white text-zinc-900 ring-2 ring-emerald-600 dark:bg-zinc-950 dark:text-zinc-50"
                        : "bg-zinc-50 text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800"
                  }`}
                >
                  {done ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M5 12l5 5L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div
                    className={`text-[11px] font-semibold tracking-wider ${
                      done
                        ? "text-emerald-700 line-through dark:text-emerald-300"
                        : isCurrent
                          ? "text-zinc-900 dark:text-zinc-50"
                          : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    PASSAGGIO {index + 1}
                  </div>
                  <div
                    className={`mt-0.5 text-sm font-medium ${
                      done
                        ? "text-zinc-500 line-through dark:text-zinc-400"
                        : isFuture
                          ? "text-zinc-500 dark:text-zinc-400"
                          : "text-zinc-800 dark:text-zinc-100"
                    }`}
                  >
                    {step.title}
                  </div>
                  {isCurrent ? (
                    <div className="mt-2">
                      <StepMarkdown content={step.content} />
                      <StepYoutubeEmbed url={step.youtubeUrl} />
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={markComplete}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
                        >
                          Segna come completato
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
        {allDone ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            Guida completata. Puoi chiudere o ricominciare quando vuoi.
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <button
          type="button"
          onClick={restart}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Ricomincia
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Riduci
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function HelpButton({ instructions, userRole, userId }: Props) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);

  const activeInstruction = useMemo(() => {
    const candidates = instructions.map((ins) => ({
      ...ins,
      isActive: ins.isActive ?? true,
      updatedAt: ins.updatedAt ? new Date(ins.updatedAt) : new Date(0),
    }));
    return pickBestInstruction(candidates, pathname, userRole);
  }, [instructions, pathname, userRole]);

  if (!activeInstruction || activeInstruction.steps.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-sm font-bold text-zinc-700 shadow-sm transition hover:border-emerald-500 hover:text-emerald-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
        title="Istruzioni per questa pagina"
        aria-label="Istruzioni per questa pagina"
      >
        ?
      </button>
      {open ? (
        <InstructionPanel
          instruction={activeInstruction}
          userId={userId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
