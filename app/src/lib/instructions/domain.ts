import { normalizePathPattern, isValidPathPattern } from "./match";

type InstructionStepInput = {
  id?: string;
  title: string;
  content: string;
  sortOrder: number;
};

export function parseInstructionStepsPayload(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    throw new Error("Passaggi istruzione non validi");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Passaggi istruzione non validi");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Inserisci almeno un passaggio");
  }

  return parsed.map((step, index) => {
    if (!step || typeof step !== "object") {
      throw new Error("Passaggi istruzione non validi");
    }

    const candidate = step as Partial<InstructionStepInput>;
    const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
    const content = typeof candidate.content === "string" ? candidate.content.trim() : "";
    const id = typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : undefined;
    const sortOrder = Number.isFinite(candidate.sortOrder) ? Number(candidate.sortOrder) : index;

    if (!title || !content) {
      throw new Error("Titolo e contenuto dei passaggi sono obbligatori");
    }

    return { id, title, content, sortOrder };
  });
}

export function validateInstructionInput(rawPathPattern: string, title: string) {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    throw new Error("Il titolo dell'istruzione è obbligatorio");
  }

  const normalizedPattern = normalizePathPattern(rawPathPattern);
  if (!isValidPathPattern(normalizedPattern)) {
    throw new Error("Il percorso non è valido. Deve iniziare con '/' ed essere un percorso corretto.");
  }

  return {
    title: normalizedTitle,
    pathPattern: normalizedPattern,
  };
}
