import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { errorResponse } from "@/lib/error-response";

export async function POST(req: Request) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
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

  const prismaModels = prisma as unknown as Record<string, unknown>;
  const dismissalClient = prismaModels["featureUpdateDismissal"] as
    | { upsert?: (args: unknown) => Promise<unknown> }
    | undefined;

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
