import { prisma } from "@/lib/prisma";

function randomSixDigitPin() {
  const value = Math.floor(Math.random() * 1_000_000);
  return value.toString().padStart(6, "0");
}

function isUniqueConstraintError(err: unknown) {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}

export async function ensureUserPersonalPin(userId: string) {
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { personalPin: true },
  });
  if (!current) return null;
  if (current.personalPin) return current.personalPin;

  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = randomSixDigitPin();
    try {
      const result = await prisma.user.updateMany({
        where: { id: userId, personalPin: null },
        data: { personalPin: candidate },
      });
      if (result.count === 1) return candidate;

      const reloaded = await prisma.user.findUnique({
        where: { id: userId },
        select: { personalPin: true },
      });
      return reloaded?.personalPin ?? null;
    } catch (err: unknown) {
      if (isUniqueConstraintError(err)) continue;
      throw err;
    }
  }

  throw new Error("Impossibile generare un PIN univoco. Riprova.");
}

