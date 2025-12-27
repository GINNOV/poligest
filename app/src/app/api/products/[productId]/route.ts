import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { errorResponse } from "@/lib/error-response";

export async function DELETE(_: Request, { params }: { params: Promise<{ productId: string }> }) {
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

  try {
    await prisma.$transaction([
      prisma.stockMovement.deleteMany({ where: { productId } }),
      prisma.product.delete({ where: { id: productId } }),
    ]);
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
