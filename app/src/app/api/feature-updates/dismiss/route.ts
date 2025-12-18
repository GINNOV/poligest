import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";

export async function POST(req: Request) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const body = (await req.json().catch(() => null)) as { updateId?: string } | null;
  const updateId = (body?.updateId ?? "").trim();
  if (!updateId) {
    return NextResponse.json({ ok: false, error: "updateId required" }, { status: 400 });
  }

  const prismaModels = prisma as unknown as Record<string, unknown>;
  const dismissalClient = prismaModels["featureUpdateDismissal"] as
    | { upsert?: (args: unknown) => Promise<unknown> }
    | undefined;

  if (!dismissalClient?.upsert) {
    return NextResponse.json(
      { ok: false, error: "Feature updates not configured" },
      { status: 500 }
    );
  }

  await dismissalClient.upsert({
    where: { userId_featureUpdateId: { userId: user.id, featureUpdateId: updateId } },
    update: { dismissedAt: new Date() },
    create: { userId: user.id, featureUpdateId: updateId, dismissedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

