import { prisma } from "@/lib/prisma";
import { stackServerApp } from "@/lib/stack-app";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

type AppUser = {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  locale: string;
  stackUserId: string;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function getUserFromStack(): Promise<AppUser | null> {
  const stackUser = await stackServerApp.getUser();
  if (!stackUser) return null;

  const email = stackUser.primaryEmail
    ? normalizeEmail(stackUser.primaryEmail)
    : null;
  if (!email) return null;

  const dbUser = await prisma.user.findUnique({ where: { email } });
  if (!dbUser) return null;

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name ?? stackUser.displayName ?? dbUser.email,
    role: dbUser.role,
    locale: dbUser.locale ?? "it",
    stackUserId: stackUser.id,
  };
}

export async function getCurrentUser(): Promise<AppUser | null> {
  return getUserFromStack();
}

export async function requireUser(allowedRoles?: Role[]): Promise<AppUser> {
  const user = await getUserFromStack();
  if (!user) {
    redirect(stackServerApp.urls.signIn);
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    redirect("/");
  }

  return user;
}

export const hasRole = (role: Role, allowed: Role[]) => allowed.includes(role);
