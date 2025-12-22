import { prisma } from "@/lib/prisma";
import { stackServerApp } from "@/lib/stack-app";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { ensureUserPersonalPin } from "@/lib/personal-pin";
import { cookies } from "next/headers";

type AppUser = {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  locale: string;
  avatarUrl?: string | null;
  stackUserId: string;
  impersonatedFrom?: string | null;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function ensurePatientRecord(email: string, fullName?: string | null) {
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

  return prisma.patient.create({
    data: {
      firstName: firstName || email,
      lastName,
      email,
      notes: "Creato automaticamente dall'account paziente.",
    },
  });
}

async function getUserFromStack(allowImpersonation = true): Promise<AppUser | null> {
  const stackUser = await stackServerApp.getUser();
  if (!stackUser) return null;

  const email = stackUser.primaryEmail
    ? normalizeEmail(stackUser.primaryEmail)
    : null;
  if (!email) return null;

  let dbUser = await prisma.user.findUnique({ where: { email } });

  if (!dbUser) {
    try {
      dbUser = await prisma.user.create({
        data: {
          email,
          name: stackUser.displayName ?? email.split("@")[0],
          // Stack-managed users authenticate via Stack tokens; keep password placeholder for NOT NULL column
          hashedPassword: "",
          role: "PATIENT",
          // hashedPassword is optional now
        },
      });
    } catch (error) {
      console.error("Failed to create user in local DB:", error);
      return null;
    }

    try {
      await ensureUserPersonalPin(dbUser.id);
    } catch (error) {
      console.error("Failed to set personal PIN at creation:", error);
    }
  }

  if (dbUser.role === Role.PATIENT) {
    try {
      await ensurePatientRecord(email, dbUser.name ?? stackUser.displayName);
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

  const baseUser: AppUser = {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name ?? stackUser.displayName ?? dbUser.email,
    role: dbUser.role,
    locale: dbUser.locale ?? "it",
    avatarUrl: dbUser.avatarUrl ?? null,
    stackUserId: stackUser.id,
    impersonatedFrom: null,
  };

  const cookieStore = await cookies();
  const impersonateUserId = allowImpersonation ? cookieStore.get("impersonateUserId")?.value : undefined;
  if (allowImpersonation && impersonateUserId && dbUser.role === Role.ADMIN && impersonateUserId !== dbUser.id) {
    const target = await prisma.user.findUnique({
      where: { id: impersonateUserId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        locale: true,
        avatarUrl: true,
      },
    });
    if (target) {
      return {
        ...baseUser,
        id: target.id,
        email: target.email,
        name: target.name ?? target.email,
        role: target.role,
        locale: target.locale ?? baseUser.locale,
        avatarUrl: target.avatarUrl ?? null,
        impersonatedFrom: baseUser.id,
      };
    }
  }

  return baseUser;
}

export async function getCurrentUser(): Promise<AppUser | null> {
  return getUserFromStack();
}

export async function requireUser(allowedRoles?: Role[], options?: { allowImpersonation?: boolean }): Promise<AppUser> {
  const user = await getUserFromStack(options?.allowImpersonation ?? true);
  if (!user) {
    redirect(stackServerApp.urls.signIn);
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    redirect("/");
  }

  return user;
}

export const hasRole = (role: Role, allowed: Role[]) => allowed.includes(role);
