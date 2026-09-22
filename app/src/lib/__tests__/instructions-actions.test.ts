import { describe, expect, it } from "vitest";
import { parseInstructionStepsPayload, validateInstructionInput } from "@/lib/instructions/domain";

const validBase = {
  rawPathPattern: "/pazienti/*",
  title: "Guida",
  description: "",
  category: "PAZIENTI",
  role: "",
  isActive: true,
};

describe("instruction actions", () => {
  it("rejects malformed instruction step payloads", () => {
    expect(() => parseInstructionStepsPayload("{")).toThrow("Passaggi istruzione non validi");
    expect(() => parseInstructionStepsPayload(JSON.stringify([{ title: "", content: "Body" }]))).toThrow(
      "Titolo passaggio obbligatorio",
    );
  });

  it("allows an empty step body and stores a canonical YouTube URL", () => {
    expect(
      parseInstructionStepsPayload(
        JSON.stringify([
          { id: " step-1 ", title: " Step ", content: "", youtubeUrl: "https://youtu.be/dQw4w9WgXcQ" },
        ]),
      ),
    ).toEqual([
      {
        id: "step-1",
        title: "Step",
        content: "",
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        sortOrder: 0,
      },
    ]);
  });

  it("rejects a non-YouTube URL", () => {
    expect(() =>
      parseInstructionStepsPayload(
        JSON.stringify([{ title: "Step", content: "", youtubeUrl: "https://example.com" }]),
      ),
    ).toThrow("URL YouTube non valido");
  });

  it("requires at least one step only when the guide is active", () => {
    expect(() =>
      validateInstructionInput({ ...validBase, steps: [] }),
    ).toThrow("Un'istruzione attiva richiede almeno un passaggio.");

    expect(
      validateInstructionInput({ ...validBase, isActive: false, steps: [] }).steps,
    ).toEqual([]);
  });
});
