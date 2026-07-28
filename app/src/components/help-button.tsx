"use client";

import { useState, useMemo } from "react";
import { usePathname } from "next/navigation";
import { Role } from "@prisma/client";
import { markStepAsDoneAction, resetProgressAction } from "@/lib/instructions/actions";
import { pickBestInstruction } from "@/lib/instructions/match";
import { clsx } from "clsx";
import { FeatureUpdateMarkdownPreview, renderInline } from "@/components/feature-update-markdown";

export type Step = {
  id: string;
  title: string;
  content: string;
  sortOrder: number;
};

export type Instruction = {
  id: string;
  title: string;
  description?: string | null;
  pathPattern: string;
  role: Role | null;
  isActive: boolean;
  updatedAt?: Date;
  steps: Step[];
};

type Props = {
  instructions: Instruction[];
  userProgress: Array<{ instructionId: string; lastStepId: string | null; completedAt: Date | null }>;
  userRole: Role;
};

export function HelpButton({ instructions, userProgress, userRole }: Props) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [progress, setProgress] = useState(userProgress);

  // Match current path with instructions using specificity ranker
  const activeInstruction = useMemo(() => {
    const candidates = instructions.map((ins) => ({
      ...ins,
      isActive: ins.isActive ?? true,
      updatedAt: ins.updatedAt ? new Date(ins.updatedAt) : new Date(0),
    }));

    return pickBestInstruction(candidates, pathname, userRole);
  }, [instructions, pathname, userRole]);

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setIsCollapsed(false);
  }

  const currentProgress = useMemo(() => {
    return progress.find((p) => p.instructionId === activeInstruction?.id);
  }, [progress, activeInstruction]);

  const currentStepIndex = useMemo(() => {
    if (!activeInstruction || activeInstruction.steps.length === 0) return -1;
    if (!currentProgress || !currentProgress.lastStepId) return 0;

    const lastIdx = activeInstruction.steps.findIndex((s) => s.id === currentProgress.lastStepId);
    if (lastIdx === -1) return 0;
    return currentProgress.completedAt ? activeInstruction.steps.length : lastIdx + 1;
  }, [activeInstruction, currentProgress]);

  const handleMarkDone = async (stepId: string) => {
    if (!activeInstruction) return;

    const res = await markStepAsDoneAction(activeInstruction.id, stepId);
    if (res.success) {
      const isLast = activeInstruction.steps.at(-1)?.id === stepId;
      setProgress((prev) => {
        const others = prev.filter((p) => p.instructionId !== activeInstruction.id);
        return [
          ...others,
          {
            instructionId: activeInstruction.id,
            lastStepId: stepId,
            completedAt: isLast ? new Date() : null,
          },
        ];
      });
    }
  };

  const handleReset = async () => {
    if (!activeInstruction) return;
    const res = await resetProgressAction(activeInstruction.id);
    if (res.success) {
      setProgress((prev) => prev.filter((p) => p.instructionId !== activeInstruction.id));
    }
  };

  if (!activeInstruction || activeInstruction.steps.length === 0) return null;

  const totalSteps = activeInstruction.steps.length;
  const isCompleted = currentStepIndex >= totalSteps;
  const displayStepNumber = Math.min(Math.max(currentStepIndex + 1, 1), totalSteps);

  return (
    <>
      {/* Header ? trigger button */}
      <button
        onClick={() => {
          setIsOpen(true);
          setIsCollapsed(false);
        }}
        className={clsx(
          "flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-200 shadow-sm",
          isCompleted
            ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400 hover:scale-105"
            : "border-zinc-200 bg-white text-zinc-700 hover:border-emerald-500 hover:text-emerald-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 hover:scale-105"
        )}
        title="Istruzioni per questa pagina"
        aria-label="Istruzioni per questa pagina"
      >
        <span className="text-sm font-bold">?</span>
      </button>

      {/* Floating Panel (Expanded / Collapsed) */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="false"
          className="fixed bottom-4 right-4 z-50 max-w-sm w-full sm:w-[380px] pointer-events-auto transition-all duration-300 ease-out"
        >
          {isCollapsed ? (
            /* Collapsed compact bar */
            <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-900 border border-zinc-800 shadow-2xl animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white shrink-0">
                  ?
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-zinc-100 truncate">
                    {renderInline(activeInstruction.title)}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {isCompleted ? "Guida completata" : `Passaggio ${displayStepNumber} di ${totalSteps}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setIsCollapsed(false)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition"
                  title="Espandi guida"
                >
                  Espandi
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-200 transition"
                  title="Chiudi"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            /* Expanded floating card */
            <div className="flex flex-col max-h-[80vh] rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
              {/* Header */}
              <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between shrink-0">
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                      ISTRUZIONI
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {isCompleted ? "Completato" : `Passaggio ${displayStepNumber}/${totalSteps}`}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 mt-1 truncate">
                    {renderInline(activeInstruction.title)}
                  </h2>
                  {activeInstruction.description && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                      {activeInstruction.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setIsCollapsed(true)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                    title="Riduci a barra compatta"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                    title="Chiudi guida"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Steps timeline content */}
              <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-5">
                {activeInstruction.steps.map((step, idx) => {
                  const isLocked = idx > currentStepIndex;
                  const isDone = idx < currentStepIndex;
                  const isCurrent = idx === currentStepIndex;

                  return (
                    <div
                      key={step.id}
                      className={clsx(
                        "relative pl-8 transition-opacity duration-200",
                        isLocked ? "opacity-35 pointer-events-none" : "opacity-100"
                      )}
                    >
                      {/* Timeline line */}
                      {idx < activeInstruction.steps.length - 1 && (
                        <div
                          className={clsx(
                            "absolute left-[13px] top-6 bottom-[-20px] w-0.5",
                            isDone ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"
                          )}
                        />
                      )}

                      {/* Step circle */}
                      <div
                        className={clsx(
                          "absolute left-0 top-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-all",
                          isDone
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : isCurrent
                            ? "border-emerald-600 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 ring-4 ring-emerald-500/10"
                            : "border-zinc-200 text-zinc-400 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                        )}
                      >
                        {isDone ? (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        ) : (
                          idx + 1
                        )}
                      </div>

                      {/* Step details */}
                      <div className="space-y-1.5">
                        <h3
                          className={clsx(
                            "font-semibold text-sm",
                            isDone ? "text-zinc-500 line-through" : "text-zinc-900 dark:text-zinc-50"
                          )}
                        >
                          {renderInline(step.title)}
                        </h3>
                        {!isLocked && (
                          <div className="text-xs text-zinc-600 dark:text-zinc-300 prose dark:prose-invert max-w-none">
                            <FeatureUpdateMarkdownPreview markdown={step.content} />
                          </div>
                        )}
                        {isCurrent && (
                          <button
                            onClick={() => handleMarkDone(step.id)}
                            className="mt-3 inline-flex h-8 items-center justify-center rounded-lg bg-emerald-600 px-3.5 text-xs font-bold text-white transition hover:bg-emerald-500 shadow-sm"
                          >
                            Segna come completato
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isCompleted && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 text-center animate-in zoom-in-95 duration-200">
                    <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      Complimenti! Hai completato tutti i passaggi.
                    </p>
                    <button
                      onClick={handleReset}
                      className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 underline underline-offset-4 hover:text-emerald-600"
                    >
                      Ricomincia guida
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-between items-center shrink-0 text-xs">
                {currentStepIndex > 0 ? (
                  <button
                    onClick={handleReset}
                    className="text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 font-medium transition flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                    Ricomincia
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsCollapsed(true)}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    Riduci
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition"
                  >
                    Chiudi
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
