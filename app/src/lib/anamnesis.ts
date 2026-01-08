import { prisma } from "@/lib/prisma";

const DEFAULT_ANAMNESIS_CONDITIONS = [
  "Affezioni cardiache",
  "Ipertensione arteriosa",
  "Malattie renali",
  "Malattie oculari",
  "Malattie ematiche",
  "Diabete",
  "Asma/Allergie",
  "Farmacoterapia",
  "Operazioni chirurgiche",
  "Fumatore",
  "Malattie infettive (es. Epatite, HIV)",
  "Malattie epatiche",
  "Malattie reumatiche",
  "Anomalie della coagulazione",
  "Gravidanza",
] as const;

type AnamnesisClient = {
  findMany?: (args?: {
    orderBy?: {
      createdAt?: "asc" | "desc";
    };
  }) => Promise<{ label?: string | null }[]>;
};

export async function getAnamnesisConditions() {
  const prismaModels = prisma as unknown as Record<string, AnamnesisClient | undefined>;
  const anamnesisClient = prismaModels["anamnesisCondition"];

  if (!anamnesisClient?.findMany) {
    return [...DEFAULT_ANAMNESIS_CONDITIONS];
  }

  const stored = await anamnesisClient.findMany({ orderBy: { createdAt: "asc" } });
  const labels = stored
    .map((item) => item.label?.trim())
    .filter((label): label is string => Boolean(label));
  const seen = new Set<string>();
  const uniqueLabels = labels.filter((label) => {
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });

  return uniqueLabels.length ? uniqueLabels : [...DEFAULT_ANAMNESIS_CONDITIONS];
}
