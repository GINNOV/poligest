"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const HELP_TEXT = [
  "Gruppi di schede che condividono codice fiscale, nome e data di nascita, oppure email/telefono con lo stesso nome.",
  "Se una scheda ha i dati e le altre sono vuote, puoi unirle. Se entrambe hanno pagamenti o cartella, apri le schede e confrontale: non eliminare da qui.",
] as const;

export function DuplicateLegendHelpTooltip() {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 bg-zinc-100 text-[11px] font-bold leading-none text-zinc-600 transition hover:border-zinc-400 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        aria-label="Come funziona il controllo duplicati"
      >
        ?
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-sm space-y-2 p-3 text-left leading-relaxed">
        {HELP_TEXT.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}