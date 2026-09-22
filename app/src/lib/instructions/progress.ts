export type InstructionProgress = {
  completedStepIds: string[];
  updatedAt: string;
};

function storageKey(userId: string, instructionId: string): string {
  return `poligest:instruction-progress:${userId}:${instructionId}`;
}

export function loadProgress(
  userId: string,
  instructionId: string,
): InstructionProgress {
  if (typeof window === "undefined") {
    return { completedStepIds: [], updatedAt: new Date(0).toISOString() };
  }
  try {
    const raw = window.localStorage.getItem(storageKey(userId, instructionId));
    if (!raw) return { completedStepIds: [], updatedAt: new Date(0).toISOString() };
    const parsed = JSON.parse(raw) as InstructionProgress;
    if (!Array.isArray(parsed.completedStepIds)) {
      return { completedStepIds: [], updatedAt: new Date(0).toISOString() };
    }
    return {
      completedStepIds: parsed.completedStepIds.filter(
        (id): id is string => typeof id === "string",
      ),
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return { completedStepIds: [], updatedAt: new Date(0).toISOString() };
  }
}

export function saveProgress(
  userId: string,
  instructionId: string,
  completedStepIds: string[],
): void {
  if (typeof window === "undefined") return;
  const payload: InstructionProgress = {
    completedStepIds,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(
    storageKey(userId, instructionId),
    JSON.stringify(payload),
  );
}

export function clearProgress(userId: string, instructionId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(userId, instructionId));
}

export function reconcileProgress(
  completedStepIds: string[],
  validStepIds: string[],
): string[] {
  const valid = new Set(validStepIds);
  return completedStepIds.filter((id) => valid.has(id));
}

export function currentStepIndex(
  orderedStepIds: string[],
  completedStepIds: string[],
): number {
  const done = new Set(completedStepIds);
  for (let i = 0; i < orderedStepIds.length; i++) {
    if (!done.has(orderedStepIds[i]!)) return i;
  }
  return orderedStepIds.length;
}
