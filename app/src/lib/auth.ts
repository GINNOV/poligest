import { cache } from "react";
import { getStackSignInUrl } from "@/lib/stack-app";
import { getRandomAvatarUrl } from "@/lib/avatars";
import { normalizePersonName } from "@/lib/name";
import { Prisma, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { ensureUserPersonalPin } from "@/lib/personal-pin";
import { demoPrisma, livePrisma } from "@/lib/prisma-client";
import { resolveRequestAccount } from "@/lib/demo/realm";

type AppUser = {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  locale: string;
  avatarUrl?: string | null;
  stackUserId: string;
  isDemo: boolean;
  impersonatedFrom?: string | null;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const getLivePrisma = async () => livePrisma;

function isSmokeAuthEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.E2E_SMOKE_AUTH === "1";
}

async function getSmokeTestUserFromDatabase(): Promise<AppUser | null> {
  const prisma = await getLivePrisma();
  const email = process.env.E2E_SMOKE_USER_EMAIL;
  const userSelect = {
    id: true,
    email: true,
    name: true,
    role: true,
    locale: true,
    avatarUrl: true,
    isDemo: true,
  } as const;
  const dbUser = email ? await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: userSelect,
  }) : await prisma.user.findFirst({
    where: { role: { in: [Role.ADMIN, Role.MANAGER, Role.ASSISTANT, Role.SECRETARY] } },
    orderBy: { createdAt: "asc" },
    select: userSelect,
  });

  if (!dbUser) {
    return null;
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
    locale: dbUser.locale ?? "it",
    avatarUrl: dbUser.avatarUrl,
    stackUserId: `smoke:${dbUser.id}`,
    isDemo: dbUser.isDemo,
    impersonatedFrom: null,
  };
}

async function ensurePatientRecord(prisma: typeof livePrisma, email: string, fullName?: string | null) {
  const existing = await prisma.patient.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (existing) return existing;

  const nameSource = (fullName ?? email.split("@")[0]).trim();
  const nameTokens = nameSource.split(" ").filter(Boolean);
  const [firstName, ...rest] = nameTokens.length ? nameTokens : [email];
  const lastName = rest.join(" ").trim() || firstName;
  const tryAttachEmail = async (candidateFirst: string, candidateLast: string) => {
    const matches = await prisma.patient.findMany({
      where: {
        AND: [
          { firstName: { equals: candidateFirst, mode: "insensitive" } },
          { lastName: { equals: candidateLast, mode: "insensitive" } },
          {
            OR: [{ email: null }, { email: "" }],
          },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 2,
    });
    if (matches.length === 1) {
      return prisma.patient.update({
        where: { id: matches[0].id },
        data: { email },
      });
    }
    return null;
  };
  if (fullName) {
    const primaryMatch = await tryAttachEmail(firstName, lastName);
    if (primaryMatch) return primaryMatch;

    if (nameTokens.length > 1) {
      const altFirstName = nameTokens[0];
      const altLastName = nameTokens[nameTokens.length - 1];
      if (altFirstName !== firstName || altLastName !== lastName) {
        const altMatch = await tryAttachEmail(altFirstName, altLastName);
        if (altMatch) return altMatch;
      }
    }

    if (nameTokens.length >= 2) {
      const firstTwoMatch = await tryAttachEmail(nameTokens[0], nameTokens[1]);
      if (firstTwoMatch) return firstTwoMatch;
    }
  }

  const normalizedFirstName = fullName ? normalizePersonName(firstName) : firstName;
  const normalizedLastName = fullName ? normalizePersonName(lastName) : lastName;

  return prisma.patient.create({
    data: {
      firstName: normalizedFirstName || email,
      lastName: normalizedLastName,
      email,
      notes: "Creato automaticamente dall'account paziente.",
    },
  });
}

const getUserFromStack = cache(async (allowImpersonation = true): Promise<AppUser | null> => {
  if (isSmokeAuthEnabled()) {
    return getSmokeTestUserFromDatabase();
  }

  const resolved = await resolveRequestAccount(allowImpersonation);
  if (!resolved) return null;

  let dbUser = resolved.account;
  if (!dbUser) {
    try {
      dbUser = await livePrisma.user.create({
        data: {
          email: resolved.email,
          name: resolved.displayName ?? resolved.email.split("@")[0],
          hashedPassword: "",
          role: "PATIENT",
          avatarUrl: getRandomAvatarUrl(),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          locale: true,
          avatarUrl: true,
          isDemo: true,
          personalPin: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        dbUser = await livePrisma.user.findUnique({
          where: { email: resolved.email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            locale: true,
            avatarUrl: true,
            isDemo: true,
            personalPin: true,
          },
        });
      }
      if (!dbUser) {
        console.error("Failed to create user in local DB:", error);
        return null;
      }
    }

    try {
      await ensureUserPersonalPin(dbUser.id);
    } catch (error) {
      console.error("Failed to set personal PIN at creation:", error);
    }
  }

  const clinical = dbUser.isDemo ? demoPrisma : livePrisma;
  if (dbUser.role === Role.PATIENT) {
    try {
      await ensurePatientRecord(clinical, dbUser.email, dbUser.name ?? resolved.displayName);
    } catch (error) {
      console.error("Failed to ensure patient record:", error);
    }
  }

  if (!dbUser.personalPin) {
    try {
      await ensureUserPersonalPin(dbUser.id);
    } catch (error) {
      console.error("Failed to backfill missing personal PIN:", error);
    }
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  livePrisma.user
    .updateMany({
      where: { id: dbUser.id, OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: oneHourAgo } }] },
      data: { lastLoginAt: new Date() },
    })
    .catch((err) => console.error("Failed to update lastLoginAt:", err));

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name ?? resolved.displayName ?? dbUser.email,
    role: dbUser.role,
    locale: dbUser.locale ?? "it",
    avatarUrl: dbUser.avatarUrl ?? null,
    stackUserId: resolved.stackUserId,
    isDemo: dbUser.isDemo,
    impersonatedFrom: resolved.impersonatedFrom,
  };
});

export async function getCurrentUser(): Promise<AppUser | null> {
  return getUserFromStack();
}

export async function requireUser(allowedRoles?: Role[], options?: { allowImpersonation?: boolean }): Promise<AppUser> {
  const user = await getUserFromStack(options?.allowImpersonation ?? true);
  if (!user) {
    redirect(getStackSignInUrl());
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    redirect("/");
  }

  return user;
}

export const hasRole = (role: Role, allowed: Role[]) => allowed.includes(role);
