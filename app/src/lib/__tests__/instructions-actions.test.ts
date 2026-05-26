import { describe, expect, it } from "vitest";
import { parseInstructionStepsPayload } from "@/lib/instructions/domain";

describe("instruction actions", () => {
  it("rejects empty instruction step payloads", () => {
    expect(() => parseInstructionStepsPayload("[]")).toThrow("Inserisci almeno un passaggio");
  });

  it("rejects malformed instruction step payloads", () => {
    expect(() => parseInstructionStepsPayload("{")).toThrow("Passaggi istruzione non validi");
    expect(() => parseInstructionStepsPayload(JSON.stringify([{ title: "", content: "Body" }]))).toThrow(
      "Titolo e contenuto dei passaggi sono obbligatori",
    );
  });

  it("normalizes valid instruction steps", () => {
    expect(
      parseInstructionStepsPayload(
        JSON.stringify([{ id: " step-1 ", title: " Step ", content: " Body ", sortOrder: 4 }]),
      ),
    ).toEqual([{ id: "step-1", title: "Step", content: "Body", sortOrder: 4 }]);
  });
});
