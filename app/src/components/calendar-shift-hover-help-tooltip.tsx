"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function CalendarShiftHoverHelpTooltip() {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 bg-zinc-100 text-[11px] font-bold leading-none text-zinc-600 transition hover:border-zinc-400 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        aria-label="Scorciatoia dettagli appuntamento"
      >
        ?
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs p-3 text-left leading-relaxed">
        <p>
          Tieni premuto <span className="font-semibold">Shift</span> e passa il mouse su un
          appuntamento per vedere i dettagli rapidi (paziente, orario, contatti, note).
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
