import type { Role } from "@prisma/client";

export const DEMO_RESET_CONFIRMATION = "Ripristina demo";

export function assertLiveClinicMutation(input: { isDemo: boolean; realmIsDemo: boolean }) {
  if (input.isDemo || input.realmIsDemo) {
    throw new Error("Lo studio dimostrativo non può modificare i dati dello studio.");
  }
}

export function canImpersonateTarget(
  actor: { role: Role; isDemo: boolean },
  target: { isDemo: boolean } | null,
) {
  if (!target || actor.role !== "ADMIN") return false;
  if (actor.isDemo) return target.isDemo;
  return true;
}
