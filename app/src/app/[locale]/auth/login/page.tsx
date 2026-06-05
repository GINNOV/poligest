import { redirect } from "next/navigation";
import { getMissingStackEnvKeys, getStackSignInUrl, isStackAuthConfigured } from "@/lib/stack-app";

export default function LoginPage() {
  if (isStackAuthConfigured()) {
    redirect(getStackSignInUrl());
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-16 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm dark:border-amber-900/60 dark:bg-zinc-950">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">
          Configurazione richiesta
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Stack Auth non configurato</h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Aggiungi le variabili Stack Auth in ambiente locale per usare l&apos;accesso reale. La pagina viene renderizzata
          così la QA del browser non finisce su un overlay di Next.js.
        </p>
        <ul className="mt-4 list-inside list-disc text-sm text-zinc-700 dark:text-zinc-300">
          {getMissingStackEnvKeys().map((key) => (
            <li key={key}>
              <code>{key}</code>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
