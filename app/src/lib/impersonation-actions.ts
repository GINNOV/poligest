"use server";

import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { endImpersonationSession } from "@/lib/impersonation-session";
import { livePrisma } from "@/lib/prisma";

export async function stopImpersonation() {
  const store = await cookies();
  const current = store.get("impersonateUserId")?.value;
  const adminId = store.get("impersonateAdminId")?.value ?? null;
  const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID;
  const admin = adminId
    ? await livePrisma.user.findUnique({ where: { id: adminId }, select: { id: true, role: true } })
    : null;

  if (projectId) {
    endImpersonationSession(store, {
      projectId,
      secure: process.env.NODE_ENV === "production",
    });
  } else {
    store.delete("impersonateUserId");
    store.delete("impersonateAdminId");
    store.delete("impersonateAdminAccess");
    store.delete("impersonateAdminRefresh");
  }

  if (current) {
    await logAudit(admin?.role === Role.ADMIN ? admin : null, {
      action: "admin.user.stop_impersonation",
      entity: "User",
      entityId: current,
    });
  }
}
