import Link from "next/link";
import { Role } from "@prisma/client";
import { dismissRecallDeliveryFailure } from "@/app/[locale]/(app)/richiami/actions";
import { RecallDeliveryFailureList } from "@/components/recall-delivery-failure-list";
import { requireUser } from "@/lib/auth";
import { getRoleFeatureAccess, requireFeatureAccess } from "@/lib/feature-access";
import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import { buildRecallDeliveryFailureAlert, formatFailedDeliverySummary } from "@/lib/recalls/delivery-alerts";
import { ASSISTANT_ROLE } from "@/lib/roles";
import {
  countFailedDeliveryRecalls,
  FAILED_DELIVERY_PAGE_SIZE,
  listFailedDeliveryRecalls,
} from "../page-data";

export const metadata = createPageMetadata(PAGE_TITLES.inviiNonRiusciti);

function readParam(value: string | string[] | undefined) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return "";
}

export default async function InviiNonRiuscitiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  await requireFeatureAccess(user.role, "agenda");
  const { isAllowed } = await getRoleFeatureAccess(user.role);
  const showPatientLink = isAllowed("patients");
  const params = await searchParams;
  const query = readParam(params.q);
  const parsedPage = Number.parseInt(readParam(params.page), 10);
  const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;

  const [total, records] = await Promise.all([
    countFailedDeliveryRecalls(query),
    listFailedDeliveryRecalls({
      query,
      skip: (page - 1) * FAILED_DELIVERY_PAGE_SIZE,
      take: FAILED_DELIVERY_PAGE_SIZE,
    }),
  ]);

  const alerts = records.map(buildRecallDeliveryFailureAlert);
  const totalPages = Math.max(1, Math.ceil(total / FAILED_DELIVERY_PAGE_SIZE));

  const pageHref = (pageNum: number) => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (pageNum > 1) next.set("page", String(pageNum));
    const search = next.toString();
    return search ? `/richiami/programmati/non-inviati?${search}` : "/richiami/programmati/non-inviati";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Richiami</p>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Invii non riusciti</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Cerca il paziente e apri la scheda per completare telefono o email.
          </p>
        </div>
        <Link
          href="/richiami/programmati"
          className="inline-flex items-center rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-emerald-800"
        >
          Torna ai richiami in scadenza
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <form method="get" action="/richiami/programmati/non-inviati" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Cerca</span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Paziente, telefono, email, regola"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-emerald-500/20"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-5 text-xs font-semibold text-white transition hover:bg-emerald-600"
            >
              Cerca
            </button>
            {query ? (
              <Link
                href="/richiami/programmati/non-inviati"
                className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-xs font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-emerald-800"
              >
                Azzera
              </Link>
            ) : null}
          </div>
        </form>

        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          {formatFailedDeliverySummary(total)}
        </p>

        <RecallDeliveryFailureList
          alerts={alerts}
          dismissAction={dismissRecallDeliveryFailure}
          showPatientLink={showPatientLink}
        />

        {totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <Link
              href={pageHref(page - 1)}
              aria-disabled={page <= 1}
              className={`rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-800 dark:text-zinc-300 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
            >
              Precedente
            </Link>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Pagina {page} di {totalPages}
            </p>
            <Link
              href={pageHref(page + 1)}
              aria-disabled={page >= totalPages}
              className={`rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-800 dark:text-zinc-300 ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
            >
              Successivo
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
