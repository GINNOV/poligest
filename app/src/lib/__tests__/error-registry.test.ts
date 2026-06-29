import { describe, expect, it } from "vitest";
import {
  classifyErrorCode,
  formatErrorRecordForCopy,
  getErrorSourceLabel,
  normalizeErrorLog,
  resolveErrorArea,
} from "@/lib/error-registry";

describe("error registry", () => {
  it("classifies app support codes and Next.js digests differently", () => {
    expect(classifyErrorCode({ supportCode: "ERR-MQYYE00V-OY61" })).toEqual({
      codeKind: "support",
      codeKindLabel: "Codice supporto app",
    });
    expect(
      classifyErrorCode({
        supportCode: "1168016264",
        source: "global_error_boundary",
        digest: "1168016264",
      }),
    ).toEqual({
      codeKind: "next_digest",
      codeKindLabel: "Digest Next.js",
    });
  });

  it("normalizes fetch and crash records with area labels", () => {
    const fetchError = normalizeErrorLog({
      id: "log-1",
      entityId: "ERR-ABC-123",
      metadata: {
        code: "ERR-ABC-123",
        message: "Errore richiesta",
        source: "fetch",
        path: "/api/patients/check-duplicate",
        context: { method: "GET", status: 404 },
      },
      actor: null,
      role: null,
      createdAt: new Date("2026-06-29T08:16:41.691Z"),
    });

    expect(fetchError.areaLabel).toBe("API");
    expect(fetchError.codeKind).toBe("support");
    expect(getErrorSourceLabel("fetch")).toBe("Navigazione / richieste API");
    expect(resolveErrorArea("global_error_boundary", "/admin/utenti").label).toBe("Amministrazione");

    const crashError = normalizeErrorLog({
      id: "log-2",
      entityId: "1168016264",
      metadata: {
        code: "1168016264",
        message: "Unhandled error",
        source: "global_error_boundary",
        path: "/admin/errori",
        error: { digest: "1168016264", name: "Error", message: "boom" },
      },
      actor: null,
      role: null,
      createdAt: new Date("2026-06-29T08:16:28.639Z"),
    });

    expect(crashError.codeKind).toBe("next_digest");
    expect(crashError.areaLabel).toBe("Amministrazione");
  });

  it("formats a copyable support bundle", () => {
    const entry = normalizeErrorLog({
      id: "log-1",
      entityId: "ERR-ABC-123",
      metadata: {
        code: "ERR-ABC-123",
        message: "Errore richiesta",
        source: "fetch",
        path: "/api/patients/check-duplicate",
      },
      actor: "Admin",
      role: "ADMIN",
      createdAt: new Date("2026-06-29T08:16:41.691Z"),
    });

    expect(formatErrorRecordForCopy(entry)).toContain("Codice supporto app: ERR-ABC-123");
    expect(formatErrorRecordForCopy(entry)).toContain("Area: API");
    expect(formatErrorRecordForCopy(entry)).toContain("Utente: Admin (ADMIN)");
  });
});