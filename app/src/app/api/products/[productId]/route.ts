import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  DELETE_CONFIRMATION_TEXT,
  isConfirmedDeleteRequest,
} from "@/lib/destructive-action-guard";
import { errorResponse } from "@/lib/error-response";

export async function DELETE(req: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);

  if (!productId) {
    return errorResponse({
      message: "Prodotto mancante",
      status: 400,
      source: "product_delete",
      actor: user,
    });
  }

  if (!isConfirmedDeleteRequest(req.headers, productId, DELETE_CONFIRMATION_TEXT)) {
    return errorResponse({
      message: `Conferma eliminazione mancante. Digita '${DELETE_CONFIRMATION_TEXT}' per procedere.`,
      status: 400,
      source: "product_delete",
      context: { productId },
      actor: user,
    });
  }

  try {
    const existing = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });
    if (!existing) {
      return errorResponse({
        message: "Prodotto non trovato",
        status: 404,
        source: "product_delete",
        context: { productId },
        actor: user,
      });
    }

    await prisma.$transaction([
      prisma.stockMovement.deleteMany({ where: { productId } }),
      prisma.product.delete({ where: { id: productId } }),
    ]);
    await logAudit(user, {
      action: "product.deleted",
      entity: "Product",
      entityId: productId,
      metadata: { productName: existing.name },
    });
    revalidatePath("/magazzino");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse({
      message: "Eliminazione prodotto non riuscita",
      status: 500,
      source: "product_delete",
      context: { productId },
      error,
      actor: user,
    });
  }
}
