"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { emitToast } from "@/components/global-toasts";
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

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const handleSubmit = () => {
      hasRecentInteraction.current = true;
      requestShow();

      window.clearTimeout(interactionCooldownRef.current);
      interactionCooldownRef.current = window.setTimeout(() => {
        hasRecentInteraction.current = false;
        requestHide();
      }, 1200);
    };

    document.addEventListener("submit", handleSubmit, true);

    return () => {
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, [requestHide, requestShow]);

  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = (async (...args: Parameters<typeof originalFetch>) => {
      const [input, init] = args;
      const method =
        (typeof init === "object" && init?.method) ||
        (typeof input === "object" && "method" in input ? (input as Request).method : undefined) ||
        "GET";

      pendingRequests.current += 1;
      requestShow();

      try {
        const response = await originalFetch(...args);
        const shouldNotify = hasRecentInteraction.current;
        if (method.toUpperCase() !== "GET" && response.ok && shouldNotify) {
          emitToast("Salvato con successo", "success");
        }
        if (!response.ok && shouldNotify) {
          emitToast("Si è verificato un errore. Riprova.", "error");
        }
        return response;
      } catch (error) {
        if (hasRecentInteraction.current) {
          emitToast("Errore di rete. Controlla la connessione.", "error");
        }
        throw error;
      } finally {
        pendingRequests.current = Math.max(0, pendingRequests.current - 1);
        requestHide();
      }
    }) as typeof fetch;

    return () => {
      window.fetch = originalFetch;
    };
  }, [requestHide, requestShow]);

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
      className={`pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-900/10 backdrop-blur-[1px] transition-opacity duration-200 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
    </div>,
    document.body
  );
}
