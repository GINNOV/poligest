import Link from "next/link";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { generateDailyReminderPreview } from "@/lib/daily-reminder";
import { getPracticeTimeZone } from "@/lib/practice-settings";
import { parseDateAtMidnightInTimeZone } from "@/lib/user-display-time-zone";

type PreviewDailyReminderPageProps = {
  searchParams?: Promise<{
    userId?: string;
    date?: string;
  }>;
};

export default async function PreviewDailyReminderPage({ searchParams }: PreviewDailyReminderPageProps) {
  await requireUser([Role.ADMIN]);

  const resolvedParams = (await searchParams) ?? {};
  const userId = resolvedParams.userId;
  const dateParam = resolvedParams.date;
  const timeZone = await getPracticeTimeZone();

  if (!userId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        <h2 className="text-lg font-semibold">Utente mancante</h2>
        <p className="mt-2 text-sm">Seleziona un utente dalla lista per vedere l&apos;anteprima del suo report.</p>
        <div className="mt-6">
          <Link href="/admin/promemoria-quotidiano" className="text-sm font-bold underline">Torna indietro</Link>
        </div>
      </div>
    );
  }

  const targetDate = dateParam 
    ? parseDateAtMidnightInTimeZone(dateParam, timeZone)
    : new Date(Date.now() + 24 * 60 * 60 * 1000);

  const result = await generateDailyReminderPreview(userId, targetDate, timeZone);

  if (result.status === "no_doctor") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        <h2 className="text-lg font-semibold">Configurazione incompleta</h2>
        <p className="mt-2 text-sm">{result.message}</p>
        <p className="mt-4 text-xs italic">Collega l&apos;utente a un profilo medico in &quot;Utenti Sistema&quot; per abilitare questa funzionalità.</p>
        <div className="mt-6">
          <Link href="/admin/promemoria-quotidiano" className="text-sm font-bold underline">Torna indietro</Link>
        </div>
      </div>
    );
  }

  const { subject, html, count } = result;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Anteprima promemoria quotidiano staff</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{subject}</p>
        </div>
        <Link
          href="/admin/promemoria-quotidiano"
          className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
        >
          Torna alla dashboard
        </Link>
      </div>

      {count === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          <p className="font-semibold text-sm">Nessun appuntamento trovato per questo medico nella data selezionata.</p>
          <p className="text-xs mt-1 italic">Il report non verrebbe inviato.</p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <iframe
          title={`Anteprima ${subject}`}
          srcDoc={html}
          className="h-[80vh] w-full rounded-xl border border-zinc-200 bg-white dark:border-zinc-800"
        />
      </div>
    </div>
  );
}
