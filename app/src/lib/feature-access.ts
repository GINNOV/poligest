import { Role } from "@prisma/client";

export type FeatureId =
  | "agenda"
  | "calendar"
  | "patients"
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
    "inventory",
    "finance",
    "communications",
  ]),
  [Role.SECRETARY]: new Set(["agenda", "calendar", "patients", "communications"]),
};
