import { Prisma } from "@prisma/client";

export function normalizeServiceSearchQuery(raw: string | string[] | undefined) {
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw)) return raw[0]?.trim() ?? "";
  return "";
}

export function buildServiceSearchFilter(query: string): Prisma.ServiceWhereInput | undefined {
  const normalized = query.trim();
  if (!normalized) return undefined;

  return {
    OR: [
      { name: { contains: normalized, mode: Prisma.QueryMode.insensitive } },
      { description: { contains: normalized, mode: Prisma.QueryMode.insensitive } },
    ],
  };
}

export function findExactServiceNameMatch<T extends { id: string; name: string }>(
  services: T[],
  query: string,
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  return services.find((service) => service.name.trim().toLowerCase() === normalized) ?? null;
}