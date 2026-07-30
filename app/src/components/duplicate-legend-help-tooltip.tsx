"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const HELP_TEXT = [
  "La ricerca segnala gruppi che condividono codice fiscale, nome con data di nascita, oppure la stessa email o telefono solo se anche nome e cognome coincidono.",
  "Per i gruppi sicuri (solo una scheda ha dati collegati, le altre sono vuote) l'admin puo unire con un click: i campi mancanti vengono copiati sulla scheda consigliata e le schede vuote eliminate.",
  "L'auto-unione notturna (se attivata) unisce solo i gruppi sicuri con segnale forte, ad esempio stesso codice fiscale.",
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