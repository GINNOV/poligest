import Link from "next/link";
import { StaffAccessLink } from "@/components/staff-access-link";
import { formatDateInDisplayTimeZone } from "@/lib/user-display-time-zone";

export function SiteFooter({
  version,
  deployedAt,
  displayTimeZone,
  showDocs = false,
  staffSignInUrl,
  staffLinkTone = "app",
}: {
  version: string;
  deployedAt?: Date | null;
  displayTimeZone: string;
  showDocs?: boolean;
  staffSignInUrl?: string;
  staffLinkTone?: "patient" | "dark" | "app";
}) {
  const deployLabel = deployedAt
    ? formatDateInDisplayTimeZone(
        deployedAt,
        {
          dateStyle: "short",
          timeStyle: "short",
        },
        displayTimeZone
      )
    : null;
  return (
    <footer className="mt-8 border-t border-zinc-200 bg-white/70 px-6 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-400">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
          (C) 2026 Garage Innovation LLC · v{version}
          {deployLabel ? ` · Aggiornato a ${deployLabel}` : ""}
        </span>
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          {staffSignInUrl ? (
            <StaffAccessLink href={staffSignInUrl} tone={staffLinkTone} className="w-full sm:w-auto" />
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-4 text-emerald-700 dark:text-emerald-300 sm:justify-end">
          {showDocs ? (
            <Link href="/docs" className="underline decoration-emerald-200 underline-offset-4 hover:text-emerald-800 dark:decoration-emerald-800 dark:hover:text-emerald-200">
              Manuale
            </Link>
          ) : null}
          <Link href="/privacy" className="underline decoration-emerald-200 underline-offset-4 hover:text-emerald-800 dark:decoration-emerald-800 dark:hover:text-emerald-200">
            Privacy
          </Link>
          <Link href="/terms" className="underline decoration-emerald-200 underline-offset-4 hover:text-emerald-800 dark:decoration-emerald-800 dark:hover:text-emerald-200">
            Termini
          </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
