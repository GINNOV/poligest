import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { getMacosAppApiKey } from "@/lib/patients/macos-api-auth";
import { AuthorizationTokensClient } from "./AuthorizationTokensClient";

export const metadata = createPageMetadata(PAGE_TITLES.authorizationTokens);

export default async function AuthorizationTokensPage() {
  await requireUser([Role.ADMIN]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-rose-50 bg-gradient-to-r from-rose-50 via-white to-white p-6 shadow-sm dark:border-zinc-800 dark:from-rose-950/30 dark:via-zinc-950 dark:to-zinc-950">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
          Sicurezza
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Authorization Tokens</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AuthorizationTokensClient sorrisoApiToken={getMacosAppApiKey()} />
      </div>
    </div>
  );
}
