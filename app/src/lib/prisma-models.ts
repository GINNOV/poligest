import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function getOptionalPrismaModel<T>(name: string): T | undefined {
  return (prisma as unknown as Record<string, unknown>)[name] as T | undefined;
}

export function isMissingPrismaModelError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021" || error.code === "P2022";
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("does not exist in the current database") ||
    error.message.includes("The table") ||
    error.message.includes("The column")
  );
}

export async function runOptionalPrismaQuery<T>(query: (() => Promise<T>) | undefined, fallback: T) {
  if (!query) {
    return {
      available: false,
      value: fallback,
    };
  }

  try {
    return {
      available: true,
      value: await query(),
    };
  } catch (error) {
    if (isMissingPrismaModelError(error)) {
      return {
        available: false,
        value: fallback,
      };
    }

    throw error;
  }
}
