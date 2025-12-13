import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function DELETE(_: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  await requireUser([Role.ADMIN, Role.MANAGER]);

  if (!productId) {
    return NextResponse.json({ error: "Prodotto mancante" }, { status: 400 });
  }

  try {
    await prisma.$transaction([
      prisma.stockMovement.deleteMany({ where: { productId } }),
      prisma.product.delete({ where: { id: productId } }),
    ]);
    revalidatePath("/magazzino");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Eliminazione prodotto non riuscita" }, { status: 500 });
  }
}
