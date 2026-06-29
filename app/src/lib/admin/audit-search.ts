import { Prisma, Role } from "@prisma/client";
import { auditLogVisibilityFilter } from "@/lib/audit";

export function normalizeAuditSearchQuery(
  value: string | string[] | undefined,
): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return "";
}

export function buildAuditDateFilter(dateParam?: string) {
  if (!dateParam || Number.isNaN(Date.parse(dateParam))) {
    return undefined;
  }

  const start = new Date(dateParam);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { gte: start, lt: end };
}

export function buildAuditLogFilters(input: {
  q?: string | string[];
  date?: string | string[];
  role?: string | string[];
  type?: string | string[];
}) {
  const q = normalizeAuditSearchQuery(input.q);
  const dateParam =
    typeof input.date === "string"
      ? input.date
      : Array.isArray(input.date)
        ? input.date[0]
        : undefined;
  const roleParam =
    typeof input.role === "string"
      ? input.role
      : Array.isArray(input.role)
        ? input.role[0]
        : undefined;
  const typeParam =
    typeof input.type === "string"
      ? input.type
      : Array.isArray(input.type)
        ? input.type[0]
        : undefined;

  const dateFilter = buildAuditDateFilter(dateParam);
  const filters: Prisma.AuditLogWhereInput[] = [auditLogVisibilityFilter()];

  if (q) {
    filters.push({
      OR: [
        { action: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { entity: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { entityId: { contains: q, mode: Prisma.QueryMode.insensitive } },
        {
          user: {
            OR: [
              { email: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
            ],
          },
        },
      ],
    });
  }

  if (dateFilter) {
    filters.push({ createdAt: dateFilter });
  }

  if (roleParam) {
    filters.push({
      user: {
        role: roleParam as Role,
      },
    });
  }

  if (typeParam) {
    filters.push({ action: typeParam });
  }

  return filters;
}