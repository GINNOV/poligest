"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavLink = {
  href: string;
  label: string;
};

type Props = {
  links: NavLink[];
};

export function MobileNav({ links }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700 lg:hidden"
        aria-label="Apri menu"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[9999] bg-black/40 px-4 py-6 lg:hidden">
          <div className="mx-auto w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Menu
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700"
                aria-label="Chiudi menu"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" d="M6 6l12 12M18 6l-12 12" />
                </svg>
              </button>
            </div>
            <nav className="mt-4 space-y-2 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-700">
              {links.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 transition ${
                    pathname === item.href
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-zinc-200 hover:border-emerald-200 hover:text-emerald-700"
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="text-emerald-700">→</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
