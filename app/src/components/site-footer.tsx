export function SiteFooter({
  version,
  deployedAt,
  showDocs = false,
}: {
  version: string;
  deployedAt?: Date | null;
  showDocs?: boolean;
}) {
  const deployLabel = deployedAt
    ? new Intl.DateTimeFormat("it-IT", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(deployedAt)
    : null;
  return (
    <footer className="mt-8 border-t border-zinc-200 bg-white/70 px-6 py-4 text-sm text-zinc-600">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-semibold text-zinc-800">
          (C) 2026 Garage Innovation LLC · v{version}
          {deployLabel ? ` · Aggiornato a ${deployLabel}` : ""}
        </span>
        <div className="flex items-center gap-4 text-emerald-700">
          {showDocs ? (
            <a href="/docs" className="underline decoration-emerald-200 underline-offset-4 hover:text-emerald-800">
              Documentazione
            </a>
          ) : null}
          <a href="/docs" className="underline decoration-emerald-200 underline-offset-4 hover:text-emerald-800">
            Manuale
          </a>
          <a href="/privacy" className="underline decoration-emerald-200 underline-offset-4 hover:text-emerald-800">
            Privacy
          </a>
          <a href="/terms" className="underline decoration-emerald-200 underline-offset-4 hover:text-emerald-800">
            Termini
          </a>
        </div>
      </div>
    </footer>
  );
}
