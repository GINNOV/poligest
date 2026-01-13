import { Role } from "@prisma/client";
import { ASSISTANT_ROLE } from "@/lib/roles";

const roleLabels: Partial<Record<Role, string>> = {
  [Role.ADMIN]: "Amministratore",
  [Role.MANAGER]: "Manager",
  [Role.SECRETARY]: "Segreteria",
  [Role.PATIENT]: "Paziente",
  [ASSISTANT_ROLE]: "Assistente",
};

export function buildStaffInviteEmail(role: Role) {
  const roleLabel = roleLabels[role] ?? role;
  return {
    subject: "Benvenuto nello staff di Agovino & Angrisano",
    text: `Ciao! Benvenuto nello staff di Agovino & Angrisano Studio Associato. Il tuo ruolo e' ${roleLabel} - Questo e' il tuo codice monouso per accedere:`,
  };
}
