import { describe, expect, it } from "vitest";
import { formatToastReportText } from "@/components/global-toasts";

describe("global toasts", () => {
  it("formats copyable error details with code and path", () => {
    expect(
      formatToastReportText({
        id: 1,
        message: "Si è verificato un errore. Riprova.",
        variant: "error",
        code: "ERR-ABC123",
        path: "/api/patients/check-duplicate",
        detail: "GET 404",
        source: "fetch",
      }),
    ).toBe(
      [
        "Si è verificato un errore. Riprova.",
        "Codice: ERR-ABC123",
        "Percorso: /api/patients/check-duplicate",
        "Dettaglio: GET 404",
        "Sorgente: fetch",
      ].join("\n"),
    );
  });
});