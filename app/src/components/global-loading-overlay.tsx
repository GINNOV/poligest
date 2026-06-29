"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { emitToast } from "@/components/global-toasts";
import {
  getFetchRequestPath,
  isIgnoredFetchFailure,
  resolveFetchRequestUrl,
} from "@/lib/fetch-error-filter";
import { subscribeNavigationLock } from "@/lib/navigation-lock";

/**
 * Displays a sitewide loading spinner whenever the user interacts or there are pending requests.
 */
export function GlobalLoadingOverlay() {
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const pendingRequests = useRef(0);
  const hideTimeoutRef = useRef<number | undefined>(undefined);
  const showDelayTimeoutRef = useRef<number | undefined>(undefined);
  const interactionCooldownRef = useRef<number | undefined>(undefined);
  const hasRecentInteraction = useRef(false);
  const lastInteractionAtRef = useRef(0);

  const markInteraction = useCallback(() => {
    lastInteractionAtRef.current = Date.now();
  }, []);

  const hadFreshInteraction = useCallback((windowMs: number) => {
    return Date.now() - lastInteractionAtRef.current <= windowMs;
  }, []);

  const requestShow = useCallback(() => {
    window.clearTimeout(hideTimeoutRef.current);
    if (showDelayTimeoutRef.current) return;

    showDelayTimeoutRef.current = window.setTimeout(() => {
      setIsVisible(true);
      showDelayTimeoutRef.current = undefined;
    }, 120);
  }, []);

  const requestHide = useCallback(() => {
    window.clearTimeout(showDelayTimeoutRef.current);
    if (pendingRequests.current > 0 || hasRecentInteraction.current) return;

    hideTimeoutRef.current = window.setTimeout(() => setIsVisible(false), 150);
  }, []);

  const requestShowImmediate = useCallback(() => {
    window.clearTimeout(hideTimeoutRef.current);
    window.clearTimeout(showDelayTimeoutRef.current);
    showDelayTimeoutRef.current = undefined;
    setIsVisible(true);
  }, []);

  const triggerNavigationLoading = useCallback(
    (duration = 1500) => {
      markInteraction();
      hasRecentInteraction.current = true;
      requestShowImmediate();
      window.clearTimeout(interactionCooldownRef.current);
      interactionCooldownRef.current = window.setTimeout(() => {
        hasRecentInteraction.current = false;
        requestHide();
      }, duration);
    },
    [markInteraction, requestHide, requestShowImmediate]
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const handleSubmit = () => {
      markInteraction();
      triggerNavigationLoading(1200);
    };

    document.addEventListener("submit", handleSubmit, true);

    return () => {
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, [markInteraction, triggerNavigationLoading]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const href = anchor.getAttribute("href") || "";
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const resolved = new URL(href, window.location.href);
      if (resolved.origin !== window.location.origin) return;
      markInteraction();
      triggerNavigationLoading(1500);
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [markInteraction, triggerNavigationLoading]);

  useEffect(() => {
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    const scheduleNavLoading = (duration: number) => {
      if (!hadFreshInteraction(600)) {
        return;
      }
      window.setTimeout(() => {
        triggerNavigationLoading(duration);
      }, 0);
    };

    const wrap = (fn: typeof window.history.pushState) => {
      return (...args: Parameters<typeof window.history.pushState>) => {
        scheduleNavLoading(1800);
        return fn.apply(window.history, args);
      };
    };

    window.history.pushState = wrap(originalPushState);
    window.history.replaceState = wrap(originalReplaceState);

    const handlePopState = () => {
      scheduleNavLoading(1200);
    };
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", handlePopState);
    };
  }, [hadFreshInteraction, triggerNavigationLoading]);

  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = (async (...args: Parameters<typeof originalFetch>) => {
      const [input, init] = args;
      const requestUrl = resolveFetchRequestUrl(input, init);
      const requestPath = getFetchRequestPath(requestUrl) || requestUrl;
      const method =
        (typeof init === "object" && init?.method) ||
          (typeof input === "object" && "method" in input ? (input as Request).method : undefined) ||
        "GET";
      const methodUpper = method.toUpperCase();
      const isErrorReport = requestUrl.includes("/api/errors/report");
      const shouldTrackRequest =
        !isErrorReport &&
        (
          (methodUpper !== "GET" && hadFreshInteraction(2000)) ||
          (methodUpper === "GET" && hadFreshInteraction(350))
        );

      if (shouldTrackRequest) {
        pendingRequests.current += 1;
        requestShow();
      }

      try {
        const response = await originalFetch(...args);
        const shouldNotify = hadFreshInteraction(5000);
        const isRedirect = response.status >= 300 && response.status < 400;
        const shouldIgnoreFailure = isIgnoredFetchFailure(requestUrl, response.status);
        if (!response.ok && !isRedirect && shouldNotify && !shouldIgnoreFailure) {
          let errorCode = response.headers.get("x-error-code");
          if (!errorCode) {
            try {
              const payload = await response.clone().json();
              if (payload && typeof payload.code === "string") {
                errorCode = payload.code;
              }
            } catch {
              // Ignore parsing errors for non-JSON payloads.
            }
          }
          if (!errorCode) {
            try {
              const reportRes = await originalFetch("/api/errors/report", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  message: "Errore richiesta",
                  source: "fetch",
                  path: requestPath || undefined,
                  context: {
                    status: response.status,
                    statusText: response.statusText,
                    method,
                  },
                }),
              });
              const reportPayload = await reportRes.json();
              if (reportPayload && typeof reportPayload.code === "string") {
                errorCode = reportPayload.code;
              }
            } catch {
              // Ignore reporting failures.
            }
          }
          emitToast("Si è verificato un errore. Riprova.", "error", {
            code: errorCode ?? undefined,
            path: requestPath || undefined,
            detail: `${methodUpper} ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`.trim(),
            source: "fetch",
          });
        }
        return response;
      } catch (error) {
        if (hadFreshInteraction(5000)) {
          let errorCode: string | undefined;
          try {
            const reportRes = await originalFetch("/api/errors/report", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                message: "Errore di rete",
                source: "fetch",
                path: requestPath || undefined,
                context: {
                  method: methodUpper,
                },
                error: error instanceof Error ? { message: error.message, name: error.name } : String(error),
              }),
            });
            const reportPayload = await reportRes.json();
            if (reportPayload && typeof reportPayload.code === "string") {
              errorCode = reportPayload.code;
            }
          } catch {
            // Ignore reporting failures.
          }

          emitToast("Errore di rete. Controlla la connessione.", "error", {
            code: errorCode,
            path: requestPath || undefined,
            detail: error instanceof Error ? error.message : "Connessione interrotta",
            source: "fetch",
          });
        }
        throw error;
      } finally {
        if (shouldTrackRequest) {
          pendingRequests.current = Math.max(0, pendingRequests.current - 1);
          requestHide();
        }
      }
    }) as typeof fetch;

    return () => {
      window.fetch = originalFetch;
    };
  }, [hadFreshInteraction, requestHide, requestShow]);

  useEffect(() => {
    requestHide();
  }, [pathname, requestHide]);

  useEffect(() => {
    return subscribeNavigationLock((locked) => {
      if (locked) {
        requestShow();
        return;
      }
      requestHide();
    });
  }, [requestHide, requestShow]);

  if (!isMounted) return null;

  return createPortal(
    <div
      aria-hidden={!isVisible}
      aria-live="polite"
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-200 ${
        isVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 via-emerald-800/15 to-amber-200/30 backdrop-blur-[2px]" />
      <div className="relative flex flex-col items-center gap-3 rounded-2xl border border-white/20 bg-white/70 px-7 py-6 text-center shadow-2xl backdrop-blur-xl dark:border-zinc-700/60 dark:bg-zinc-950/80">
        <div className="relative flex h-12 w-12 items-center justify-center">
          <span className="absolute inset-0 animate-spin rounded-full border-4 border-emerald-200/70 border-t-emerald-600" />
          <span className="absolute inset-[6px] animate-[spin_1.6s_linear_infinite] rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Operazione in corso</p>
          <p className="text-xs text-zinc-600 dark:text-zinc-300">Stiamo aggiornando i dati. Attendi qualche secondo.</p>
        </div>
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950/40">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-300" />
        </div>
      </div>
    </div>,
    document.body
  );
}
