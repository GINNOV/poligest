"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SignOutButton } from "./sign-out-button";

type Props = {
  name: string;
  email: string;
  avatarUrl?: string | null;
  roleLabel?: string;
  profileHref?: string;
  adminHref?: string;
  adminLabel?: string;
  signOutUrl?: string;
};

export function UserMenu({
  name,
  email,
  avatarUrl,
  roleLabel,
  profileHref = "/profilo",
  adminHref,
  adminLabel,
  signOutUrl = "/handler/sign-out",
}: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const initials = (name || email || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="relative z-50" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-3 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-emerald-200 hover:text-emerald-800"
        aria-expanded={open}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt="Avatar"
            className="h-9 w-9 rounded-full border border-zinc-200 object-cover"
          />
        ) : (
          <span className="grid h-9 w-9 place-items-center rounded-full border border-zinc-200 bg-zinc-100 text-[11px] font-semibold text-zinc-700">
            {initials}
          </span>
        )}
        <span className="flex flex-col items-start leading-tight">
          <span className="text-sm font-semibold">{name || email}</span>
          {roleLabel ? (
            <span className="text-[11px] uppercase tracking-[0.08em] text-emerald-700">{roleLabel}</span>
          ) : null}
        </span>
        <span className={`text-xs transition ${open ? "rotate-180" : ""}`} aria-hidden>
          ▼
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-zinc-200 bg-white shadow-lg">
          <div className="flex flex-col divide-y divide-zinc-100 text-sm font-semibold text-zinc-800">
            <Link
              href={profileHref}
              className="flex items-center gap-2 px-4 py-3 hover:bg-emerald-50 hover:text-emerald-800"
              onClick={() => setOpen(false)}
            >
              <span aria-hidden>👤</span>
              Profilo
            </Link>
            {adminHref && adminLabel ? (
              <Link
                href={adminHref}
                className="flex items-center gap-2 px-4 py-3 hover:bg-emerald-50 hover:text-emerald-800"
                onClick={() => setOpen(false)}
              >
                <span aria-hidden>🛠️</span>
                {adminLabel}
              </Link>
            ) : null}
            <div className="px-3 py-2">
              <SignOutButton label="🚪 Esci" signOutUrl={signOutUrl} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
