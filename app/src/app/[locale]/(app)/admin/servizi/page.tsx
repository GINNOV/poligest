import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import { Role } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ServicesCatalog } from "@/components/admin/services-catalog";
import { syncServiceCatalogFormatting } from "@/lib/admin/service-catalog-sync";
import {
  buildServiceSearchFilter,
  findExactServiceNameMatch,
  normalizeServiceSearchQuery,
} from "@/lib/admin/services-search";

export const metadata = createPageMetadata(PAGE_TITLES.servizi);

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser([Role.ADMIN]);
  const t = await getTranslations("admin");
  const searchParamsValue = await searchParams;
  await syncServiceCatalogFormatting();

  const query = normalizeServiceSearchQuery(searchParamsValue.q);
  const searchFilter = buildServiceSearchFilter(query);

  const [services, totalCount, allServices] = await Promise.all([
    prisma.service.findMany({
      where: searchFilter,
      orderBy: [{ name: "asc" }],
    }),
    prisma.service.count(),
    prisma.service.findMany({
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }],
    }),
  ]);

  const exactMatch = findExactServiceNameMatch(allServices, query);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            {t("services")}
          </p>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{t("servicesTitle")}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("servicesSubtitle")}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
          {totalCount} {totalCount === 1 ? "servizio" : "servizi"}
        </span>
      </div>

      <ServicesCatalog
        services={services.map((service) => ({
          id: service.id,
          name: service.name,
          description: service.description,
          costBasis: service.costBasis.toString(),
        }))}
        totalCount={totalCount}
        query={query}
        exactMatchId={exactMatch?.id ?? null}
        labels={{
          createTitle: t("servicesCreate"),
          createHint: t("servicesCreateHint"),
          name: t("servicesName"),
          namePlaceholder: t("servicesNamePlaceholder"),
          description: t("servicesDescription"),
          descriptionPlaceholder: t("servicesDescriptionPlaceholder"),
          cost: t("servicesCost"),
          createButton: t("servicesCreateButton"),
          listTitle: t("servicesList"),
          searchLabel: t("servicesSearchLabel"),
          searchPlaceholder: t("servicesSearchPlaceholder"),
          apply: t("apply"),
          reset: t("resetFilters"),
          empty: t("servicesEmpty"),
          noResults: t("servicesNoResults"),
          exactMatch: t("servicesExactMatch"),
          resultsCount: t("servicesResultsCount"),
          edit: t("servicesEdit"),
          cancel: t("servicesCancel"),
          save: t("servicesSave"),
          delete: t("servicesDelete"),
          noDescription: t("servicesNoDescription"),
        }}
      />
    </div>
  );
}