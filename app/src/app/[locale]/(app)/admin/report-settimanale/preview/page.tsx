import Link from "next/link";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { createPracticeWeeklyReportPeriod, generatePracticeWeeklyReportPreview, getCompletedPracticeWeekPeriod } from "@/lib/practice-weekly-report";

type PreviewWeeklyReportPageProps = {
  searchParams?: Promise<{
    start?: string;
    endExclusive?: string;
  }>;
};

function parseIsoDate(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default async function PreviewWeeklyReportPage({ searchParams }: PreviewWeeklyReportPageProps) {
  await requireUser([Role.ADMIN]);

  const resolvedParams = (await searchParams) ?? {};
  const requestedStart = parseIsoDate(resolvedParams.start);
  const requestedEndExclusive = parseIsoDate(resolvedParams.endExclusive);

  const period =
    requestedStart && requestedEndExclusive
      ? createPracticeWeeklyReportPeriod(requestedStart, requestedEndExclusive)
      : getCompletedPracticeWeekPeriod();

  const preview = await generatePracticeWeeklyReportPreview(period);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Anteprima report settimanale</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{preview.subject}</p>
        </div>
        <Link
          href="/admin/report-settimanale"
          className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
        >
          Torna alla dashboard
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <iframe
          title={`Anteprima ${preview.subject}`}
          srcDoc={preview.html}
          className="h-[80vh] w-full rounded-xl border border-zinc-200 bg-white dark:border-zinc-800"
        />
      </div>
    </div>
  );
}
