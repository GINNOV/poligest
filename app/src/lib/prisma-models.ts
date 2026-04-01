import { prisma } from "@/lib/prisma";

export function getOptionalPrismaModel<T>(name: string): T | undefined {
  return (prisma as unknown as Record<string, unknown>)[name] as T | undefined;
}
