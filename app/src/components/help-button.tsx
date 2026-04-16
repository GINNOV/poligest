"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Role } from "@prisma/client";
import { markStepAsDoneAction, resetProgressAction } from "@/lib/instructions/actions";
import { clsx } from "clsx";
import { FeatureUpdateMarkdownPreview } from "@/components/feature-update-markdown";

type Step = {
  id: string;
  title: string;
  content: string;
  sortOrder: number;
};

type Instruction = {
  id: string;
  title: string;
  description?: string | null;
  pathPattern: string;
  role: Role | null;
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
  const [progress, setProgress] = useState(userProgress);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Match current path with instructions
  const activeInstruction = useMemo(() => {
    return instructions.find((ins) => {
      // Check role
      if (ins.role && ins.role !== userRole) return false;
      
      // Check path pattern (simplified regex match)
      try {
        const pattern = ins.pathPattern.replace(/\[.*?\]/g, ".*");
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(pathname) || pathname.startsWith(ins.pathPattern);
      } catch {
        return pathname.startsWith(ins.pathPattern);
      }
    });
  }, [instructions, pathname, userRole]);

  const currentProgress = useMemo(() => {
    return progress.find((p) => p.instructionId === activeInstruction?.id);
  }, [progress, activeInstruction]);

  const currentStepIndex = useMemo(() => {
    if (!activeInstruction) return -1;
    if (!currentProgress || !currentProgress.lastStepId) return 0;
    
    const lastIdx = activeInstruction.steps.findIndex(s => s.id === currentProgress.lastStepId);
    return currentProgress.completedAt ? activeInstruction.steps.length : lastIdx + 1;
  }, [activeInstruction, currentProgress]);

  const handleMarkDone = async (stepId: string) => {
    if (!activeInstruction) return;
    
    const res = await markStepAsDoneAction(activeInstruction.id, stepId);
    if (res.success) {
      const isLast = activeInstruction.steps[activeInstruction.steps.length - 1].id === stepId;
      setProgress(prev => {
        const others = prev.filter(p => p.instructionId !== activeInstruction.id);
        return [...others, { 
          instructionId: activeInstruction.id, 
          lastStepId: stepId, 
          completedAt: isLast ? new Date() : null 
        }];
      });
    }
  };

  const handleReset = async () => {
    if (!activeInstruction) return;
    const res = await resetProgressAction(activeInstruction.id);
    if (res.success) {
      setProgress(prev => prev.filter(p => p.instructionId !== activeInstruction.id));
    }
  };

  if (!activeInstruction) return null;

  const isCompleted = currentStepIndex >= activeInstruction.steps.length;

  const modal = isOpen && mounted ? createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
      <div className="relative w-full max-w-[90vw] md:max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-zinc-950 border dark:border-zinc-800 flex flex-col max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 truncate">{activeInstruction.title}</h2>
            {activeInstruction.description && (
              <p className="text-sm text-zinc-500 mt-1 truncate">{activeInstruction.description}</p>
            )}
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 text-zinc-400 hover:text-zinc-600 transition shrink-0"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6">
          {activeInstruction.steps.map((step, idx) => {
            const isLocked = idx > currentStepIndex;
            const isDone = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <div 
                key={step.id} 
                className={clsx(
                  "relative pl-10 transition-opacity duration-300",
                  isLocked ? "opacity-30 pointer-events-none" : "opacity-100"
                )}
              >
                {/* Progress Line */}
                {idx < activeInstruction.steps.length - 1 && (
                  <div className={clsx(
                    "absolute left-[15px] top-8 bottom-[-24px] w-0.5",
                    isDone ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"
                  )} />
                )}

                {/* Step Number Circle */}
                <div className={clsx(
                  "absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                  isDone ? "bg-emerald-500 border-emerald-500 text-white" : 
                  isCurrent ? "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" : 
                  "border-zinc-200 text-zinc-400 dark:border-zinc-800"
                )}>
                  {isDone ? (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                  ) : idx + 1}
                </div>

                <div className="space-y-2">
                  <h3 className={clsx(
                    "font-semibold text-base",
                    isDone ? "text-zinc-500 line-through" : "text-zinc-900 dark:text-zinc-50"
                  )}>
                    {step.title}
                  </h3>
                  {!isLocked && (
                    <div className="text-sm text-zinc-600 dark:text-zinc-300 prose dark:prose-invert max-w-none">
                      <FeatureUpdateMarkdownPreview markdown={step.content} />
                    </div>
                  )}
                  {isCurrent && (
                    <button
                      onClick={() => handleMarkDone(step.id)}
                      className="mt-4 inline-flex h-9 items-center justify-center rounded-full bg-emerald-600 px-4 text-xs font-bold text-white transition hover:bg-emerald-500"
                    >
                      Segna come completato
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {isCompleted && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-center animate-in zoom-in-95 duration-300">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                Complimenti! Hai completato tutti i passaggi.
              </p>
              <button 
                onClick={handleReset}
                className="mt-3 text-xs font-bold text-emerald-700 dark:text-emerald-400 underline underline-offset-4 hover:text-emerald-600"
              >
                Ricomincia guida
              </button>
            </div>
          )}
        </div>

        <div className="p-6 border-t dark:border-zinc-800 flex justify-between items-center shrink-0">
          {currentStepIndex > 0 && (
            <button
              onClick={handleReset}
              className="text-sm font-medium text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              Ricomincia
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="h-10 rounded-full border border-zinc-200 px-6 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 ml-auto"
          >
            Chiudi
          </button>
        </div>      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={clsx(
          "flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-200",
          isCompleted 
            ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400" 
            : "border-zinc-200 bg-white text-zinc-600 hover:border-emerald-300 hover:text-emerald-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
        )}
        title="Istruzioni per questa pagina"
      >
        <span className="text-sm font-bold">?</span>
      </button>

      {modal}
    </>
  );
}
