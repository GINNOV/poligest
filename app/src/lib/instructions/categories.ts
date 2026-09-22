/**
 * Fixed areas for staff instruction guides.
 * Order defines admin list ranking (top → bottom).
 */

export const INSTRUCTION_CATEGORY_IDS = [
  "GIORNATA",
  "AGENDA",
  "PAZIENTI",
  "RICHIAMI",
  "MAGAZZINO",
  "FINANZA",
  "MEDICI",
  "AMMINISTRAZIONE",
  "PROFILO",
  "GENERALE",
] as const;

export type InstructionCategoryId = (typeof INSTRUCTION_CATEGORY_IDS)[number];

export type InstructionCategoryOption = {
  readonly id: InstructionCategoryId;
  readonly label: string;
  readonly sortRank: number;
};

export const INSTRUCTION_CATEGORIES: readonly InstructionCategoryOption[] =
  INSTRUCTION_CATEGORY_IDS.map((id, index) => ({
    id,
    sortRank: index,
    label: categoryLabelForId(id),
  }));

function categoryLabelForId(id: InstructionCategoryId): string {
  switch (id) {
    case "GIORNATA":
      return "Giornata";
    case "AGENDA":
      return "Agenda";
    case "PAZIENTI":
      return "Pazienti";
    case "RICHIAMI":
      return "Richiami";
    case "MAGAZZINO":
      return "Magazzino";
    case "FINANZA":
      return "Finanza";
    case "MEDICI":
      return "Medici";
    case "AMMINISTRAZIONE":
      return "Amministrazione";
    case "PROFILO":
      return "Profilo";
    case "GENERALE":
      return "Generale";
  }
}

export const DEFAULT_INSTRUCTION_CATEGORY: InstructionCategoryId = "GENERALE";

const CATEGORY_SET = new Set<string>(INSTRUCTION_CATEGORY_IDS);

export function isInstructionCategoryId(
  value: string | null | undefined,
): value is InstructionCategoryId {
  return value != null && CATEGORY_SET.has(value);
}

export function normalizeInstructionCategory(
  value: string | null | undefined,
): InstructionCategoryId {
  if (isInstructionCategoryId(value)) return value;
  return DEFAULT_INSTRUCTION_CATEGORY;
}

export function instructionCategoryLabel(
  value: string | null | undefined,
): string {
  const id = normalizeInstructionCategory(value);
  return INSTRUCTION_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function instructionCategorySortRank(
  value: string | null | undefined,
): number {
  const id = normalizeInstructionCategory(value);
  return INSTRUCTION_CATEGORIES.find((c) => c.id === id)?.sortRank ?? 999;
}

/** Best-effort category from a path pattern. */
export function inferInstructionCategoryFromPath(
  pathPattern: string,
): InstructionCategoryId {
  const p = pathPattern.trim().toLowerCase();
  if (p === "/dashboard" || p === "/dashboard/*") return "GIORNATA";
  if (p.includes("/agenda")) return "AGENDA";
  if (p.includes("/pazienti")) return "PAZIENTI";
  if (p.includes("/richiami")) return "RICHIAMI";
  if (p.includes("/magazzino")) return "MAGAZZINO";
  if (p.includes("/finanza")) return "FINANZA";
  if (p.includes("/medici")) return "MEDICI";
  if (p.includes("/admin")) return "AMMINISTRAZIONE";
  if (p.includes("/profilo")) return "PROFILO";
  return "GENERALE";
}

export function compareInstructionsByCategoryThenTitle(
  a: { readonly category?: string | null; readonly title: string },
  b: { readonly category?: string | null; readonly title: string },
): number {
  const rank =
    instructionCategorySortRank(a.category) -
    instructionCategorySortRank(b.category);
  if (rank !== 0) return rank;
  return a.title.localeCompare(b.title, "it", { sensitivity: "base" });
}
