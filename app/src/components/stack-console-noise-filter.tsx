"use client";

import { useEffect } from "react";

const STACK_ANALYTICS_WARNING = "EventTracker flush failed:";
const STACK_ANALYTICS_DISABLED = "ANALYTICS_NOT_ENABLED";

export function StackConsoleNoiseFilter() {
  useEffect(() => {
    const originalWarn = window.console.warn;
    const originalError = window.console.error;

    const shouldSuppress = (args: unknown[]) => {
      const firstArg = typeof args[0] === "string" ? args[0] : "";
      const hasAnalyticsDisabledPayload = args.some(
        (arg) =>
          (typeof arg === "string" && arg.includes(STACK_ANALYTICS_DISABLED)) ||
          (arg instanceof Error && arg.message.includes(STACK_ANALYTICS_DISABLED)),
      );

      if (firstArg.includes(STACK_ANALYTICS_WARNING) && hasAnalyticsDisabledPayload) {
        return true;
      }

      return false;
    };

    window.console.warn = (...args: unknown[]) => {
      if (shouldSuppress(args)) {
        return;
      }

      originalWarn(...args);
    };

    window.console.error = (...args: unknown[]) => {
      if (shouldSuppress(args)) {
        return;
      }

      originalError(...args);
    };

    return () => {
      window.console.warn = originalWarn;
      window.console.error = originalError;
    };
  }, []);

  return null;
}
