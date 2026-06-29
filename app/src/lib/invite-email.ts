import { Role } from "@prisma/client";
import { ASSISTANT_ROLE } from "@/lib/roles";

const roleLabels: Partial<Record<Role, string>> = {
  [Role.ADMIN]: "Amministratore",
  [Role.MANAGER]: "Dottore",
  [Role.SECRETARY]: "Segreteria",
  [Role.PATIENT]: "Paziente",
  [ASSISTANT_ROLE]: "Assistente",
};

export function getStaffRoleLabel(role: Role) {
  return roleLabels[role] ?? role;
}