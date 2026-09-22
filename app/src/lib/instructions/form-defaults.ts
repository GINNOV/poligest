import {
  inferInstructionCategoryFromPath,
  type InstructionCategoryId,
} from "@/lib/instructions/categories";

export const DEFAULT_INSTRUCTION_PATH_PATTERN = "/pazienti/*";

export type InstructionFormStep = {
  readonly id?: string;
  readonly title: string;
  readonly content: string;
  readonly youtubeUrl: string;
};

export type InstructionStaffRole = "ADMIN" | "MANAGER" | "ASSISTANT" | "SECRETARY";

export type InstructionFormDefaults = {
  readonly title: string;
  readonly description: string;
  readonly pathPattern: string;
  readonly category: InstructionCategoryId;
  readonly role: "" | InstructionStaffRole;
  readonly isActive: boolean;
  readonly steps: InstructionFormStep[];
};

export const emptyInstructionForm: InstructionFormDefaults = {
  title: "",
  description: "",
  pathPattern: DEFAULT_INSTRUCTION_PATH_PATTERN,
  category: inferInstructionCategoryFromPath(DEFAULT_INSTRUCTION_PATH_PATTERN),
  role: "",
  isActive: true,
  steps: [{ title: "", content: "", youtubeUrl: "" }],
};
