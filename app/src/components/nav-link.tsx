"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import {
  isNavigationLocked,
  setNavigationLocked,
  subscribeNavigationLock,
} from "@/lib/navigation-lock";

export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname() || "";
  const isActive = pathname === href || pathname.endsWith(href);
  const [isLocked, setIsLocked] = useState(isNavigationLocked());
  const fallbackTimeoutRef = useRef<number | null>(null);

  useEffect(() => subscribeNavigationLock(setIsLocked), []);

  useEffect(() => {
    if (isNavigationLocked()) {
      setNavigationLocked(false);
    }
    if (fallbackTimeoutRef.current) {
      window.clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = null;
    }
  }, [pathname]);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }

    if (isNavigationLocked()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    setNavigationLocked(true);
    if (fallbackTimeoutRef.current) {
      window.clearTimeout(fallbackTimeoutRef.current);
    }
    fallbackTimeoutRef.current = window.setTimeout(() => {
      setNavigationLocked(false);
    }, 5000);
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      aria-busy={isLocked}
      className={`relative pb-1 transition hover:text-emerald-700 ${
        isActive ? "text-emerald-800" : ""
      } ${isLocked ? "pointer-events-none opacity-70" : ""}`}
    >
      <span>{label}</span>
      {isActive ? (
        <span className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-emerald-600" />
      ) : null}
    </Link>
  );
}
