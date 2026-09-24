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

export async function provisionDemoLogins() {
  const password = await ensureDemoAccounts();
  const stack = getStackServerApp() as unknown as StackApp;
  const accounts = await livePrisma.user.findMany({
    where: { isDemo: true, demoPassword: { not: null } },
    select: { email: true, name: true, demoPassword: true },
  });

  for (const account of accounts) {
    const demoPassword = account.demoPassword;
    if (!demoPassword) continue;
    const matches = await stack.listUsers({ query: account.email, limit: 10 });
    const existing = matches.find((user) => user.primaryEmail?.toLowerCase() === account.email);
    if (existing) {
      await existing.setPassword({ password: demoPassword });
      continue;
    }
    await stack.createUser({
      primaryEmail: account.email,
      primaryEmailVerified: true,
      primaryEmailAuthEnabled: true,
      password: demoPassword,
      displayName: account.name || account.email,
    });
  }

  return { password, accounts: accounts.map((account) => account.email) };
}
