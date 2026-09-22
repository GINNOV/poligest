import { Role } from "@prisma/client";
import { normalizeInstructionCategory, type InstructionCategoryId } from "./categories";
import { isValidPathPattern, normalizePathPattern } from "./match";
import { normalizeYoutubeUrl } from "./youtube";

const STAFF_ROLES = new Set<string>([
  Role.ADMIN,
  Role.MANAGER,
  Role.ASSISTANT,
  Role.SECRETARY,
]);

export type ParsedInstructionStep = {
  id?: string;
  title: string;
  content: string;
  youtubeUrl: string | null;
  sortOrder: number;
};

const YOUTUBE_ERROR =
  "URL YouTube non valido. Usa un link watch, youtu.be, embed o shorts.";

export function parseInstructionStepsPayload(value: FormDataEntryValue | null): ParsedInstructionStep[] {
  if (typeof value !== "string") {
    throw new Error("Passaggi istruzione non validi");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Passaggi istruzione non validi");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Passaggi istruzione non validi");
  }
  if (parsed.length > 50) {
    throw new Error("Troppi passaggi");
  }

  return parsed.map((step, index) => {
    if (!step || typeof step !== "object") {
      throw new Error("Passaggi istruzione non validi");
    }

    const candidate = step as {
      id?: unknown;
      title?: unknown;
      content?: unknown;
      youtubeUrl?: unknown;
    };
    const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
    const content = typeof candidate.content === "string" ? candidate.content : "";
    const id =
      typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : undefined;
    const rawYoutube = typeof candidate.youtubeUrl === "string" ? candidate.youtubeUrl : "";

    if (!title) {
      throw new Error("Titolo passaggio obbligatorio");
    }
    if (title.length > 200) {
      throw new Error("Titolo passaggio troppo lungo");
    }
    if (content.length > 20_000) {
      throw new Error("Contenuto del passaggio troppo lungo");
    }

    const youtubeUrl = rawYoutube.trim() ? normalizeYoutubeUrl(rawYoutube) : null;
    if (rawYoutube.trim() && !youtubeUrl) {
      throw new Error(YOUTUBE_ERROR);
    }

    return { id, title, content, youtubeUrl, sortOrder: index };
  });
}

export function validateInstructionInput(input: {
  rawPathPattern: string;
  title: string;
  description?: string | null;
  category?: string | null;
  role?: string | null;
  isActive: boolean;
  steps: ParsedInstructionStep[];
}) {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Il titolo dell'istruzione è obbligatorio");
  }
  if (title.length > 120) {
    throw new Error("Il titolo dell'istruzione è troppo lungo");
  }

  const description = (input.description ?? "").trim();
  if (description.length > 500) {
    throw new Error("La descrizione è troppo lunga");
  }

  if (input.rawPathPattern.trim().length > 200) {
    throw new Error("Il percorso non è valido. Deve iniziare con '/' ed essere un percorso corretto.");
  }
  const pathPattern = normalizePathPattern(input.rawPathPattern);
  if (!isValidPathPattern(pathPattern)) {
    throw new Error("Il percorso non è valido. Deve iniziare con '/' ed essere un percorso corretto.");
  }

  const category: InstructionCategoryId = normalizeInstructionCategory(input.category);
  const role =
    input.role && STAFF_ROLES.has(input.role) ? (input.role as Role) : null;

  if (input.isActive && input.steps.length < 1) {
    throw new Error("Un'istruzione attiva richiede almeno un passaggio.");
  }

  return {
    title,
    pathPattern,
    description: description || null,
    category,
    role,
    isActive: input.isActive,
    steps: input.steps,
  };
}
