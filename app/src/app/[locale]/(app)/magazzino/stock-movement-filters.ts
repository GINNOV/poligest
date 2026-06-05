import { Prisma } from "@prisma/client";

type StockMovementFilterInput = {
  mq?: string | string[] | null;
  from?: string | string[] | null;
  to?: string | string[] | null;
};

const firstString = (value: string | string[] | null | undefined) => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
};

export const parseDateStart = (value: string) => {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const parseDateEnd = (value: string) => {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const searchTokenWhere = (token: string): Prisma.StockMovementWhereInput => ({
  OR: [
    { product: { is: { name: { contains: token, mode: Prisma.QueryMode.insensitive } } } },
    { product: { is: { brand: { contains: token, mode: Prisma.QueryMode.insensitive } } } },
    { product: { is: { serviceType: { contains: token, mode: Prisma.QueryMode.insensitive } } } },
    { product: { is: { udiDi: { contains: token, mode: Prisma.QueryMode.insensitive } } } },
    { product: { is: { udiPi: { contains: token, mode: Prisma.QueryMode.insensitive } } } },
    { udiPi: { contains: token, mode: Prisma.QueryMode.insensitive } },
    { interventionSite: { contains: token, mode: Prisma.QueryMode.insensitive } },
    { note: { contains: token, mode: Prisma.QueryMode.insensitive } },
    { patient: { is: { firstName: { contains: token, mode: Prisma.QueryMode.insensitive } } } },
    { patient: { is: { lastName: { contains: token, mode: Prisma.QueryMode.insensitive } } } },
  ],
});

export const implantProductWhere: Prisma.ProductWhereInput = {
  OR: [
    { name: { contains: "impianto", mode: Prisma.QueryMode.insensitive } },
    { serviceType: { contains: "impianto", mode: Prisma.QueryMode.insensitive } },
  ],
};

export const nonImplantProductWhere: Prisma.ProductWhereInput = {
  NOT: implantProductWhere,
};

export const nonImplantStockMovementWhere: Prisma.StockMovementWhereInput = {
  product: { is: nonImplantProductWhere },
};

export function buildStockMovementFilters(input: StockMovementFilterInput) {
  const movementQuery = firstString(input.mq).trim();
  const fromParam = firstString(input.from);
  const toParam = firstString(input.to);
  const dateFrom = parseDateStart(fromParam);
  const dateTo = parseDateEnd(toParam);
  const clauses: Prisma.StockMovementWhereInput[] = [nonImplantStockMovementWhere];

  const searchTokens = movementQuery.split(/\s+/).filter(Boolean);
  if (searchTokens.length > 0) {
    clauses.push(...searchTokens.map(searchTokenWhere));
  }

  if (dateFrom || dateTo) {
    const dateRange = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };

    clauses.push({
      OR: [
        { createdAt: dateRange },
        { purchaseDate: dateRange },
        { interventionDate: dateRange },
      ],
    });
  }

  const where =
    clauses.length === 0
      ? undefined
      : clauses.length === 1
        ? clauses[0]
        : { AND: clauses };

  return {
    dateFrom,
    dateTo,
    fromParam,
    hasFilters: Boolean(movementQuery || fromParam || toParam),
    movementQuery,
    toParam,
    where,
  };
}
