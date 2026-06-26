import Link from "next/link";
import { cn } from "@/lib/utils";

function StaffAccessIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

type StaffAccessLinkProps = {
  href: string;
  className?: string;
  tone?: "patient" | "dark" | "app";
};

export function StaffAccessLink({ href, className, tone = "patient" }: StaffAccessLinkProps) {
  const toneClass =
    tone === "dark"
      ? "border-slate-600 bg-slate-800 text-cyan-100 hover:border-cyan-500/70 hover:bg-slate-700 hover:text-white"
      : tone === "app"
        ? "border-slate-700 bg-slate-900 text-cyan-100 hover:border-cyan-500/70 hover:bg-slate-800 hover:text-white"
        : "border-slate-800 bg-slate-900 text-cyan-50 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.55)] hover:border-cyan-600/60 hover:bg-slate-800 hover:text-white";

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition",
        toneClass,
        className,
      )}
    >
      <StaffAccessIcon className="h-4 w-4 shrink-0 text-cyan-400" />
      <span>Accesso staff</span>
    </Link>
  );
}