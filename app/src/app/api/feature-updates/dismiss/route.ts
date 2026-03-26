import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getOptionalPrismaModel } from "@/lib/prisma-models";
import { Role } from "@prisma/client";
import { errorResponse } from "@/lib/error-response";
import { ASSISTANT_ROLE } from "@/lib/roles";

export async function POST(req: Request) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  const body = (await req.json().catch(() => null)) as { updateId?: string } | null;
  const updateId = (body?.updateId ?? "").trim();
  if (!updateId) {
    return errorResponse({
      message: "updateId required",
      status: 400,
      source: "feature_update_dismiss",
      actor: user,
    });
  }

  const dismissalClient = getOptionalPrismaModel<{ upsert?: (args: unknown) => Promise<unknown> }>(
    "featureUpdateDismissal"
  );

  if (!dismissalClient?.upsert) {
    return errorResponse({
      message: "Feature updates not configured",
      status: 500,
      source: "feature_update_dismiss",
      actor: user,
    });
  }

  try {
    await dismissalClient.upsert({
      where: { user_feature_update_unique: { userId: user.id, featureUpdateId: updateId } },
      update: { dismissedAt: new Date() },
      create: { userId: user.id, featureUpdateId: updateId, dismissedAt: new Date() },
    });
  } catch (error) {
    return errorResponse({
      message: "Salvataggio preferenza non riuscito",
      status: 500,
      source: "feature_update_dismiss",
      context: { updateId },
      error,
      actor: user,
    });
  }

  return NextResponse.json({ ok: true });
}
