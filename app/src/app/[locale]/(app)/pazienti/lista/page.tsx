import Link from "next/link";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { PatientDeleteButton } from "@/components/patient-delete-button";
import { PatientListFilters } from "@/components/patient-list-filters";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { formatPhone } from "@/lib/phone";
import { parsePatientStructuredNotes } from "@/lib/patients/page-data-domain";

const PAGE_SIZE = 20;

export default async function PazientiListaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined> | URLSearchParams>;
}) {
  const rawParams = await searchParams;
  const params =
    rawParams instanceof URLSearchParams
      ? rawParams
      : new URLSearchParams(
          Object.entries(rawParams).flatMap(([key, value]) =>
            value === undefined ? [] : Array.isArray(value) ? value.map((v) => [key, v]) : [[key, value]],
          ),
        );

  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  await requireFeatureAccess(user.role, "patients");

  const qParam = params.get("q") ?? undefined;
  const searchQuery = qParam?.toLowerCase();
  const searchTokens = searchQuery ? searchQuery.split(/\s+/).filter(Boolean) : [];

  const sortRaw = params.get("sort") ?? undefined;
  const sortOption =
    sortRaw === "name_desc" || sortRaw === "date_asc" || sortRaw === "date_desc" ? sortRaw : "name_asc";

  const pageParam = params.get("page") ?? "1";
  const requestedPage = Math.max(1, Number.isNaN(Number(pageParam)) ? 1 : Number(pageParam));

  const where: Prisma.PatientWhereInput =
    searchTokens.length > 0
      ? {
          AND: searchTokens.map((token) => ({
            OR: [
              { firstName: { contains: token, mode: Prisma.QueryMode.insensitive } },
              { lastName: { contains: token, mode: Prisma.QueryMode.insensitive } },
              { email: { contains: token, mode: Prisma.QueryMode.insensitive } },
              { phone: { contains: token, mode: Prisma.QueryMode.insensitive } },
            ],
          })),
        }
      : {};

  const [patients, staffUsers, consentModules] = await Promise.all([
    prisma.patient.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        photoUrl: true,
        birthDate: true,
        notes: true,
        hasPaperConsentForRequired: true,
        consents: {
          select: {
            moduleId: true,
            status: true,
            module: { select: { name: true } },
          },
        },
        createdAt: true,
      },
      where,
    }),
    prisma.user.findMany({
      select: { email: true },
      where: {
        role: { not: Role.PATIENT },
      },
    }),
    prisma.consentModule.findMany({
      where: { active: true, required: true },
      select: { id: true, name: true },
    }),
  ]);

  const getDisplayName = (p: { firstName?: string | null; lastName?: string | null }) =>
    `${(p.lastName ?? "").trim()} ${(p.firstName ?? "").trim()}`.trim() || "Paziente senza nome";

  const compareNames = (
    a: { firstName?: string | null; lastName?: string | null; createdAt: Date },
    b: { firstName?: string | null; lastName?: string | null; createdAt: Date },
  ) => {
    const nameA = getDisplayName(a).toLowerCase();
    const nameB = getDisplayName(b).toLowerCase();
    if (nameA !== nameB) {
      return nameA.localeCompare(nameB, "it", { sensitivity: "base" });
    }
    return (a.createdAt?.getTime?.() ?? 0) - (b.createdAt?.getTime?.() ?? 0);
  };

  const staffEmails = new Set(
    staffUsers
      .map((user) => user.email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email)),
  );
  const filteredPatients = staffEmails.size
    ? patients.filter((patient) => {
        if (!patient.email) return true;
        return !staffEmails.has(patient.email.trim().toLowerCase());
      })
    : patients;

  const totalCount = filteredPatients.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * PAGE_SIZE;

  const sortedPatients =
    sortOption === "name_desc" || sortOption === "name_asc"
      ? [...filteredPatients].sort((a, b) =>
          sortOption === "name_desc" ? -compareNames(a, b) : compareNames(a, b),
        )
      : [...filteredPatients].sort((a, b) =>
          sortOption === "date_desc"
            ? (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0)
            : (a.createdAt?.getTime?.() ?? 0) - (b.createdAt?.getTime?.() ?? 0),
        );

  const requiredModules = consentModules;
  const paginatedPatients = sortedPatients.slice(skip, skip + PAGE_SIZE);
  const letterTargets = new Map<string, { page: number; id: string }>();

  sortedPatients.forEach((patient, index) => {
    const displayName = getDisplayName(patient);
    const initialRaw = displayName.trim().charAt(0);
    if (!initialRaw) return;
    const normalizedInitial = initialRaw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const letter = normalizedInitial.toLocaleUpperCase("it");
    if (letter < "A" || letter > "Z") return;
    if (!letterTargets.has(letter)) {
      letterTargets.set(letter, {
        page: Math.floor(index / PAGE_SIZE) + 1,
        id: patient.id,
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const preview = paginatedPatients
      .slice(0, 5)
      .map((p) => getDisplayName(p) || "—");
    console.info("[pazienti] sort applied", {
      sortRaw,
      sortOption,
      preview,
      count: paginatedPatients.length,
      total: sortedPatients.length,
      page,
    });
  }
  const showingFrom = totalCount === 0 ? 0 : skip + 1;
  const showingTo = Math.min(skip + paginatedPatients.length, totalCount);
  const buildPageHref = (targetPage: number) => {
    const query = new URLSearchParams();
    if (qParam) query.set("q", qParam);
    if (sortRaw) query.set("sort", sortRaw);
    query.set("page", String(targetPage));
    return `/pazienti/lista?${query.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Pazienti</p>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Lista pazienti</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Cerca, filtra e apri le schede paziente esistenti.
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
        <PatientListFilters initialQuery={qParam ?? ""} sortValue={sortRaw ?? sortOption} />
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">Legenda:</span>
          <span className="inline-flex items-center gap-1">
            <span className="text-rose-600 dark:text-rose-400">▲</span>
            Consensi obbligatori mancanti
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-violet-600 dark:text-violet-400">●</span>
            Consensi obbligatori presenti su scheda cartacea
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-zinc-500 dark:text-zinc-400">📧</span>
            Email mancante
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-zinc-500 dark:text-zinc-400">☎️</span>
            Telefono mancante
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-emerald-600 dark:text-emerald-400">✓</span>
            Dati completi
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1 text-sm font-semibold uppercase text-zinc-500 dark:text-zinc-400">
          {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => {
            const target = letterTargets.get(letter);
            if (!target) {
              return (
                <span key={letter} className="px-1 text-zinc-300 dark:text-zinc-700">
                  {letter}
                </span>
              );
            }
            return (
              <Link
                key={letter}
                href={`${buildPageHref(target.page)}#patient-${target.id}`}
                className="rounded px-1 text-emerald-700 transition hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                {letter}
              </Link>
            );
          })}
        </div>
        <div className="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {paginatedPatients.length === 0 ? (
            <p className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-400">Nessun paziente registrato.</p>
          ) : (
            paginatedPatients.map((patient) => {
              const activeConsents = patient.consents.filter((consent) => consent.status === "GRANTED");
              const missingEmail = !patient.email;
              const missingPhone = !patient.phone;
              const hasMissingRequired = requiredModules.some(
                (module) => !activeConsents.some((consent) => consent.moduleId === module.id),
              );
              const indicators: Array<{ title: string; className: string; icon: string }> = [];
              if (hasMissingRequired) {
                indicators.push({
                  title: patient.hasPaperConsentForRequired
                    ? "Consensi obbligatori presenti su scheda cartacea"
                    : "Consensi obbligatori mancanti",
                  className: patient.hasPaperConsentForRequired ? "text-violet-600 dark:text-violet-400" : "text-rose-600 dark:text-rose-400",
                  icon: patient.hasPaperConsentForRequired ? "●" : "▲",
                });
              }
              if (missingEmail) {
                indicators.push({
                  title: "Email mancante",
                  className: "text-zinc-500 dark:text-zinc-400",
                  icon: "📧",
                });
              }
              if (missingPhone) {
                indicators.push({
                  title: "Telefono mancante",
                  className: "text-zinc-500 dark:text-zinc-400",
                  icon: "☎️",
                });
              }
              if (indicators.length === 0) {
                indicators.push({
                  title: "Dati completi",
                  className: "text-emerald-600 dark:text-emerald-400",
                  icon: "✓",
                });
              }
              const badge = indicators.map((item, index) => (
                <span
                  key={`${patient.id}-indicator-${index}`}
                  title={item.title}
                  className={item.className}
                >
                  {item.icon}
                </span>
              ));

              const { parsedTaxId } = parsePatientStructuredNotes(patient.notes);
              const birthDateLabel = patient.birthDate
                ? new Intl.DateTimeFormat("it-IT", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  }).format(new Date(patient.birthDate))
                : null;

              return (
                <div
                  key={patient.id}
                  id={`patient-${patient.id}`}
                  className="flex flex-col gap-2 py-3 pl-4 pr-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-2 text-lg sm:hidden" aria-hidden={!badge}>
                    {badge}
                  </div>
                  <div className="flex flex-col">
                    <Link
                      href={`/pazienti/${patient.id}`}
                      className="text-sm font-semibold text-emerald-800 underline decoration-emerald-200 underline-offset-2 dark:text-emerald-400 dark:decoration-emerald-900"
                    >
                      <span className="mr-2 inline-flex items-center gap-1 align-middle">{badge}</span>
                      {patient.lastName} {patient.firstName}
                    </Link>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                      {patient.email ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-[10px]">📧</span> {patient.email}
                        </span>
                      ) : null}
                      {patient.phone ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-[10px]">☎️</span> {formatPhone(patient.phone)}
                        </span>
                      ) : null}
                      {birthDateLabel ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-[10px]">🎂</span> {birthDateLabel}
                        </span>
                      ) : null}
                      {parsedTaxId ? (
                        <span className="inline-flex items-center gap-1 font-mono uppercase">
                          <span className="text-[10px]">📄</span> {parsedTaxId}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    {activeConsents.map((consent) => (
                      <span
                        key={consent.moduleId}
                        className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200"
                      >
                        {consent.module?.name ?? "Modulo"}
                      </span>
                    ))}
                    <Link
                      href={`/pazienti/${patient.id}`}
                      className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-emerald-400 dark:hover:border-emerald-800 dark:hover:text-emerald-300"
                    >
                      Scheda
                    </Link>
                    <PatientDeleteButton patientId={patient.id} />
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <p>
            Mostrati {totalCount === 0 ? "0" : `${showingFrom}-${Math.min(showingTo, totalCount)}`} di{" "}
            {totalCount}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={buildPageHref(page - 1)}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-emerald-800 dark:hover:text-emerald-300"
              >
                ← Precedente
              </Link>
            ) : (
              <span className="rounded-full border border-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
                ← Precedente
              </span>
            )}
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Pagina {page} di {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={buildPageHref(page + 1)}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-emerald-800 dark:hover:text-emerald-300"
              >
                Successiva →
              </Link>
            ) : (
              <span className="rounded-full border border-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
                Successiva →
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
