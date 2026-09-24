import { cache } from "react";
import { cookies } from "next/headers";
import { Prisma, Role } from "@prisma/client";
import { getOptionalStackServerApp } from "@/lib/stack-app";
import { demoPrisma, livePrisma } from "@/lib/prisma-client";
import { canImpersonateTarget } from "@/lib/demo/guard";

export type DemoAccount = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  locale: string;
  avatarUrl: string | null;
  isDemo: boolean;
  personalPin: string | null;
};

const accountSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  locale: true,
  avatarUrl: true,
  isDemo: true,
  personalPin: true,
} as const;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function loadAccount(where: Prisma.UserWhereUniqueInput) {
  return livePrisma.user.findUnique({ where, select: accountSelect });
}

export const resolveRequestAccount = cache(async (allowImpersonation = true): Promise<{
  email: string;
  displayName: string | null;
  stackUserId: string;
  account: DemoAccount | null;
  impersonatedFrom: string | null;
} | null> => {
  const stackServerApp = getOptionalStackServerApp();
  if (!stackServerApp) return null;
  const stackUser = await stackServerApp.getUser();
  if (!stackUser?.primaryEmail) return null;

  const email = normalizeEmail(stackUser.primaryEmail);
  const account = await loadAccount({ email });
  if (!account) {
    return {
      email,
      displayName: stackUser.displayName ?? null,
      stackUserId: stackUser.id,
      account: null,
      impersonatedFrom: null,
    };
  }

  const cookieStore = await cookies();
  const impersonateUserId = allowImpersonation ? cookieStore.get("impersonateUserId")?.value : undefined;
  const impersonateAdminId = allowImpersonation ? cookieStore.get("impersonateAdminId")?.value : undefined;

  if (impersonateUserId && impersonateUserId !== account.id && account.role === Role.ADMIN) {
    const target = await loadAccount({ id: impersonateUserId });
    if (target && canImpersonateTarget(account, target)) {
      return {
        email: target.email,
        displayName: target.name,
        stackUserId: stackUser.id,
        account: target,
        impersonatedFrom: account.id,
      };
    }
  }

  return {
    email: account.email,
    displayName: account.name ?? stackUser.displayName ?? null,
    stackUserId: stackUser.id,
    account,
    impersonatedFrom:
      allowImpersonation && impersonateUserId && impersonateUserId === account.id
        ? impersonateAdminId ?? "impersonation"
        : null,
  };
});

const mirroredUsers = new Set<string>();

export async function ensureDemoUserMirrored(userId: string) {
  if (mirroredUsers.has(userId)) return;
  const user = await livePrisma.user.findUnique({ where: { id: userId } });
  if (!user?.isDemo) return;
  const data = {
    email: user.email,
    name: user.name,
    hashedPassword: user.hashedPassword,
    role: user.role,
    locale: user.locale,
    isActive: user.isActive,
    avatarUrl: user.avatarUrl,
    personalPin: user.personalPin,
    gender: user.gender,
    isDemo: true,
    demoPassword: user.demoPassword,
    lastLoginAt: user.lastLoginAt,
  };
  await demoPrisma.user.upsert({
    where: { id: user.id },
    create: { id: user.id, ...data },
    update: data,
  });
  mirroredUsers.add(userId);
}

export function forgetDemoMirror(userId: string) {
  mirroredUsers.delete(userId);
}

export async function isDemoRealm() {
  let resolved: Awaited<ReturnType<typeof resolveRequestAccount>> = null;
  try {
    resolved = await resolveRequestAccount(true);
  } catch {
    return false;
  }
  if (!resolved?.account?.isDemo) return false;
  await ensureDemoUserMirrored(resolved.account.id);
  return true;
}
