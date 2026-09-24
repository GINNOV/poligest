import { getStackServerApp } from "@/lib/stack-app";
import { livePrisma } from "@/lib/prisma-client";
import { ensureDemoAccounts } from "@/lib/demo/seed";

type StackUser = {
  id: string;
  primaryEmail?: string | null;
  setPassword: (options: { password: string }) => Promise<unknown>;
};

type StackApp = {
  listUsers: (options: { query?: string; limit?: number }) => Promise<StackUser[]>;
  createUser: (options: {
    primaryEmail: string;
    primaryEmailVerified: boolean;
    primaryEmailAuthEnabled: boolean;
    password: string;
    displayName: string;
  }) => Promise<StackUser>;
};

export async function setDemoStackPassword(email: string, name: string | null, password: string) {
  const stack = getStackServerApp() as unknown as StackApp;
  const normalized = email.trim().toLowerCase();
  const matches = await stack.listUsers({ query: normalized, limit: 10 });
  const existing = matches.find((user) => user.primaryEmail?.toLowerCase() === normalized);
  if (existing) {
    await existing.setPassword({ password });
    return;
  }
  await stack.createUser({
    primaryEmail: normalized,
    primaryEmailVerified: true,
    primaryEmailAuthEnabled: true,
    password,
    displayName: name || normalized,
  });
}

export async function provisionDemoLogins() {
  const password = await ensureDemoAccounts();
  const accounts = await livePrisma.user.findMany({
    where: { isDemo: true, demoPassword: { not: null } },
    select: { email: true, name: true, demoPassword: true },
  });

  for (const account of accounts) {
    const demoPassword = account.demoPassword;
    if (!demoPassword) continue;
    await setDemoStackPassword(account.email, account.name, demoPassword);
  }

  return { password, accounts: accounts.map((account) => account.email) };
}
