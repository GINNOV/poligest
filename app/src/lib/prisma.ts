import type { Prisma, PrismaClient } from "@prisma/client";
import { demoPrisma, isPrismaConfigured, livePrisma } from "@/lib/prisma-client";

export { demoPrisma, isPrismaConfigured, livePrisma };

type PrismaClientWithLogs = PrismaClient<
  Prisma.PrismaClientOptions,
  "query" | "info" | "warn" | "error"
>;

async function resolveClient() {
  const { isDemoRealm } = await import("@/lib/demo/realm");
  return (await isDemoRealm()) ? demoPrisma : livePrisma;
}

function forward(target: object, prop: PropertyKey) {
  return (...args: unknown[]) =>
    resolveClient().then((client) => {
      const value = (client as unknown as Record<PropertyKey, unknown>)[prop];
      if (typeof value === "function") {
        return (value as (...params: unknown[]) => unknown).apply(client, args);
      }
      return value;
    });
}

export const prisma: PrismaClientWithLogs = new Proxy(livePrisma, {
  get(target, prop, receiver) {
    if (typeof prop !== "string") {
      return Reflect.get(target, prop, receiver);
    }
    if (prop === "then") return undefined;
    if (prop.startsWith("$")) {
      return forward(target, prop);
    }
    if (!(prop in livePrisma)) return undefined;
    return new Proxy(
      {},
      {
        get(_modelTarget, operation) {
          if (operation === "then") return undefined;
          return (...args: unknown[]) =>
            resolveClient().then((client) => {
              const delegate = (client as unknown as Record<string, Record<PropertyKey, unknown>>)[prop];
              const fn = delegate?.[operation];
              if (typeof fn === "function") return fn.apply(delegate, args);
              return fn;
            });
        },
      },
    );
  },
}) as PrismaClientWithLogs;
