"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  CRASH_CONTEXT_STORAGE_KEY,
  type CrashBreadcrumb,
  parseCrashContext,
  serializeCrashContext,
} from "@/lib/crash-context";

function persistBreadcrumb(nextEntry: CrashBreadcrumb) {
  try {
    const current = parseCrashContext(window.sessionStorage.getItem(CRASH_CONTEXT_STORAGE_KEY));
    const breadcrumbs = [...(current?.breadcrumbs ?? []), nextEntry];
    const snapshot = {
      capturedAt: new Date().toISOString(),
      href: window.location.href,
      referrer: document.referrer || undefined,
      userAgent: navigator.userAgent,
      online: navigator.onLine,
      breadcrumbs,
    };
    window.sessionStorage.setItem(CRASH_CONTEXT_STORAGE_KEY, serializeCrashContext(snapshot));
  } catch {
    // Ignore storage failures.
  }
}

function describeElement(target: HTMLElement | null) {
  if (!target) return "elemento sconosciuto";

  const clickable = target.closest("button, a, summary, input[type='submit']") as HTMLElement | null;
  const element = clickable ?? target;
  const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
  const aria = element.getAttribute("aria-label")?.trim();
  const name = element.getAttribute("name")?.trim();
  const href = element instanceof HTMLAnchorElement ? element.getAttribute("href")?.trim() : undefined;
  const tag = element.tagName.toLowerCase();

  return [tag, aria || name || text || href].filter(Boolean).join(": ");
}

export function CrashContextTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    persistBreadcrumb({
      type: "pageview",
      at: new Date().toISOString(),
      path: query ? `${pathname}?${query}` : pathname,
      detail: "Navigazione pagina",
    });
  }, [pathname, searchParams]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      persistBreadcrumb({
        type: "click",
        at: new Date().toISOString(),
        path: window.location.pathname,
        detail: describeElement(event.target as HTMLElement | null),
      });
    };

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      const action = form?.getAttribute("action") || form?.getAttribute("data-action") || "submit";
      persistBreadcrumb({
        type: "submit",
        at: new Date().toISOString(),
        path: window.location.pathname,
        detail: `form: ${action}`,
      });
    };

    const onOnline = () => {
      persistBreadcrumb({
        type: "network",
        at: new Date().toISOString(),
        path: window.location.pathname,
        detail: "browser online",
      });
    };

    const onOffline = () => {
      persistBreadcrumb({
        type: "network",
        at: new Date().toISOString(),
        path: window.location.pathname,
        detail: "browser offline",
      });
    };

    const onVisibilityChange = () => {
      persistBreadcrumb({
        type: "visibility",
        at: new Date().toISOString(),
        path: window.location.pathname,
        detail: document.visibilityState,
      });
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}

