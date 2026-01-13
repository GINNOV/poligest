import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ASSISTANT_ROLE } from "@/lib/roles";

export type FeatureId =
  | "agenda"
  | "calendar"
  | "patients"
  | "quotes"
  | "clinical-records"
  | "inventory"
  | "finance"
  | "communications"
  | "audit"
  | "users"
  | "danger-zone";

export const FEATURES: { id: FeatureId; label: string; description: string }[] = [
  {
    id: "agenda",
    label: "Agenda e richiami",
    description: "Visualizza e gestisci appuntamenti, conferme e richiami.",
  },
  {
    id: "calendar",
    label: "Calendario",
    description: "Vista mensile per medico con inserimento rapido appuntamenti.",
  },
  {
    id: "patients",
    label: "Pazienti e cartella",
    description: "Anagrafica, consensi, note cliniche e documenti.",
  },
  {
    id: "quotes",
    label: "Preventivi",
    description: "Crea e stampa preventivi per il paziente.",
  },
  {
    id: "clinical-records",
    label: "Diario clinico",
    description: "Gestisci interventi e cartella clinica odontoiatrica.",
  },
  {
    id: "inventory",
    label: "Magazzino",
    description: "Prodotti, giacenze e movimenti di carico/scarico.",
  },
  {
    id: "finance",
    label: "Finanza e cassa",
    description: "Spese, incassi, anticipi ai medici e rendiconti.",
  },
  {
    id: "communications",
    label: "Comunicazioni e SMS",
    description: "Template, invii programmati e registro dei messaggi.",
  },
  {
    id: "audit",
    label: "Audit e sicurezza",
    description: "Registro eventi, attività sospette e controlli.",
  },
  {
    id: "users",
    label: "Utenti e ruoli",
    description: "Creazione account, lingue e stato degli utenti.",
  },
  {
    id: "danger-zone",
    label: "Operazioni critiche",
    description: "Reset sistema e azioni rischiose.",
  },
];

export const FALLBACK_PERMISSIONS: Partial<Record<Role, Set<FeatureId>>> = {
  [Role.ADMIN]: new Set(FEATURES.map((feature) => feature.id)),
  [Role.MANAGER]: new Set([
    "agenda",
    "calendar",
    "patients",
    "quotes",
    "clinical-records",
    "inventory",
    "finance",
    "communications",
  ]),
  [ASSISTANT_ROLE]: new Set(["agenda", "calendar", "patients", "quotes", "clinical-records", "communications"]),
  [Role.SECRETARY]: new Set(["agenda", "calendar", "patients", "quotes", "clinical-records", "communications"]),
};

export async function getRoleFeatureAccess(role: Role) {
  const accessEntries = await prisma.roleFeatureAccess.findMany({
    where: { role },
    select: { feature: true, allowed: true },
  });
  const allowedMap = new Map<FeatureId, boolean>(
    accessEntries.map((entry) => [entry.feature as FeatureId, entry.allowed])
  );
  const isAllowed = (feature: FeatureId) =>
    allowedMap.get(feature) ?? (FALLBACK_PERMISSIONS[role]?.has(feature) ?? false);

  return { isAllowed, allowedMap };
}

export async function requireFeatureAccess(
  role: Role,
  feature: FeatureId,
  redirectTo = "/dashboard"
) {
  const { isAllowed } = await getRoleFeatureAccess(role);
  if (!isAllowed(feature)) {
    redirect(redirectTo);
  }
}
