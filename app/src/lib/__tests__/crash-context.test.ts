import { describe, expect, it } from "vitest";
import {
  buildCrashSupportEmail,
  parseCrashContext,
  serializeCrashContext,
  trimCrashBreadcrumbs,
  type CrashBreadcrumb,
} from "@/lib/crash-context";

describe("crash-context", () => {
  it("keeps only the most recent breadcrumbs", () => {
    const breadcrumbs = Array.from({ length: 25 }, (_, index) => ({
      type: "click" as const,
      at: `2026-03-28T00:00:${String(index).padStart(2, "0")}Z`,
      detail: `step-${index}`,
    }));

    const trimmed = trimCrashBreadcrumbs(breadcrumbs, 3);
    expect(trimmed.map((entry) => entry.detail)).toEqual(["step-22", "step-23", "step-24"]);
  });

  it("round-trips stored context safely", () => {
    const snapshot = {
      capturedAt: "2026-03-28T10:00:00.000Z",
      href: "https://example.com/agenda/appuntamenti",
      online: true,
      breadcrumbs: [
        { type: "pageview", at: "2026-03-28T10:00:00.000Z", detail: "Navigazione pagina" },
      ] satisfies CrashBreadcrumb[],
    };

    const parsed = parseCrashContext(serializeCrashContext(snapshot));
    expect(parsed?.href).toBe(snapshot.href);
    expect(parsed?.breadcrumbs).toHaveLength(1);
  });

  it("builds a support email with the crash context", () => {
    const href = buildCrashSupportEmail({
      supportEmail: "support@example.com",
      errorCode: "ERR-123",
      pagePath: "/agenda/appuntamenti",
      snapshot: {
        capturedAt: "2026-03-28T10:00:00.000Z",
        href: "https://example.com/agenda/appuntamenti",
        online: false,
        breadcrumbs: [
          {
            type: "click",
            at: "2026-03-28T10:00:01.000Z",
            path: "/agenda",
            detail: "a: Appuntamenti esistenti",
          },
        ],
      },
    });

    expect(href).toContain("mailto:support@example.com");
    expect(decodeURIComponent(href)).toContain("ERR-123");
    expect(decodeURIComponent(href)).toContain("Appuntamenti esistenti");
  });
});

