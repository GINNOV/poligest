"use client";

import { useEffect } from "react";

const STACK_ANALYTICS_WARNING = "EventTracker flush failed:";
const STACK_ANALYTICS_DISABLED = "ANALYTICS_NOT_ENABLED";

export function StackConsoleNoiseFilter() {
  useEffect(() => {
    const originalWarn = window.console.warn;

    window.console.warn = (...args: unknown[]) => {
      const firstArg = typeof args[0] === "string" ? args[0] : "";
      const hasAnalyticsDisabledPayload = args.some(
        (arg) =>
          (typeof arg === "string" && arg.includes(STACK_ANALYTICS_DISABLED)) ||
          (arg instanceof Error && arg.message.includes(STACK_ANALYTICS_DISABLED)),
      );

      if (firstArg.includes(STACK_ANALYTICS_WARNING) && hasAnalyticsDisabledPayload) {
        return;
      }

      originalWarn(...args);
    };

    return () => {
      window.console.warn = originalWarn;
    };
  }, []);

  return null;
}
