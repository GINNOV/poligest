"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname() || "";
  const isActive = pathname === href || pathname.endsWith(href);

  return (
    <Link
      href={href}
      className={`relative pb-1 transition hover:text-emerald-700 ${
        isActive ? "text-emerald-800" : ""
      }`}
    >
      <span>{label}</span>
      {isActive ? (
        <span className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-emerald-600" />
      ) : null}
    </Link>
  );
}
