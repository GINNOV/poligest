import { StackProvider } from "@stackframe/stack";
import { getMissingStackEnvKeys, getOptionalStackServerApp } from "@/lib/stack-app";
import { headers } from "next/headers";
import { SiteFooter } from "@/components/site-footer";
import { StackAuthHandlerShell } from "@/components/stack-auth-handler-shell";
import { getAppVersion, getDeployDate } from "@/lib/version";
import { getPracticeTimeZone } from "@/lib/practice-settings";
import { redirect } from "next/navigation";
import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";

export const metadata = createPageMetadata(PAGE_TITLES.accesso);

// Optional catch-all so /handler and /handler/* both work for Stack OAuth callbacks.
export default async function StackAuthHandlerPage(props: {
  params: Promise<{ stack?: string[] }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const headerList = await headers();
  const forwardedHost = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const forwardedProto = headerList.get("x-forwarded-proto") ?? "https";
  if (process.env.NODE_ENV !== "production" && forwardedHost?.split(",")[0].trim().startsWith("127.0.0.1")) {
    const stackPath = (params.stack ?? []).join("/");
    const pathname = stackPath ? `/handler/${stackPath}` : "/handler";
    const query = new URLSearchParams(
      Object.entries(searchParams).flatMap(([key, value]) => (typeof value === "string" ? [[key, value]] : [])),
    ).toString();
    redirect(`http://localhost:3000${pathname}${query ? `?${query}` : ""}`);
  }
  const requestOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost.split(",")[0].trim()}` : undefined;
  const stackServerApp = getOptionalStackServerApp(requestOrigin);

  const audienceRaw = (searchParams?.audience ?? searchParams?.role ?? "").toLowerCase();
  const isStaff = audienceRaw === "staff";
  const version = getAppVersion();
  const deployedAt = getDeployDate();
  const displayTimeZone = await getPracticeTimeZone();

  if (!stackServerApp) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-16 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm dark:border-amber-900/60 dark:bg-zinc-950">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">
            Configurazione richiesta
          </p>
          <h1 className="mt-3 text-2xl font-semibold">Stack Auth non configurato</h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Configura Stack Auth per usare la pagina di accesso reale.
          </p>
          <ul className="mt-4 list-inside list-disc text-sm text-zinc-700 dark:text-zinc-300">
            {getMissingStackEnvKeys().map((key) => (
              <li key={key}>
                <code>{key}</code>
              </li>
            ))}
          </ul>
          <SiteFooter version={version} deployedAt={deployedAt} displayTimeZone={displayTimeZone} />
        </div>
      </main>
    );
  }

  return (
    <StackProvider app={stackServerApp} lang="it-IT">
      <StackAuthHandlerShell
        isStaff={isStaff}
        version={version}
        deployedAt={deployedAt}
        displayTimeZone={displayTimeZone}
      />
    </StackProvider>
  );
}