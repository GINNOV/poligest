import { describe, expect, it } from "vitest";
import { PAPER_CONSENT_NOTE, withPaperConsentNote } from "@/lib/patients/paper-consent";

describe("withPaperConsentNote", () => {
  it("appends the paper consent note when enabled", () => {
    expect(withPaperConsentNote("Codice Fiscale: RSSMRA80A01H501U", true)).toBe(
      `Codice Fiscale: RSSMRA80A01H501U\n${PAPER_CONSENT_NOTE}`,
    );
  });

  it("removes the paper consent note when disabled", () => {
    expect(
      withPaperConsentNote(
        `Codice Fiscale: RSSMRA80A01H501U\n${PAPER_CONSENT_NOTE}`,
        false,
      ),
    ).toBe("Codice Fiscale: RSSMRA80A01H501U");
  });

  it("does not duplicate the paper consent note", () => {
    expect(
      withPaperConsentNote(
        `Codice Fiscale: RSSMRA80A01H501U\n${PAPER_CONSENT_NOTE}`,
        true,
      ),
    ).toBe(`Codice Fiscale: RSSMRA80A01H501U\n${PAPER_CONSENT_NOTE}`);
  });
});