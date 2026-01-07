import Link from "next/link";
import { Prisma, Role, ConsentType, ConsentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PatientDeleteButton } from "@/components/patient-delete-button";

const PAGE_SIZE = 20;

const consentLabels: Partial<Record<ConsentType, string>> = {
  [ConsentType.PRIVACY]: "Privacy",
  [ConsentType.TREATMENT]: "Trattamento",
};

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

  await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);

  const qParam = params.get("q") ?? undefined;
  const searchQuery = qParam?.toLowerCase();

  const sortRaw = params.get("sort") ?? undefined;
  const sortOption =
    sortRaw === "name_desc" || sortRaw === "date_asc" || sortRaw === "date_desc" ? sortRaw : "name_asc";

  const pageParam = params.get("page") ?? "1";
  const requestedPage = Math.max(1, Number.isNaN(Number(pageParam)) ? 1 : Number(pageParam));

  const where: Prisma.PatientWhereInput =
    searchQuery && searchQuery.length > 0
      ? {
          OR: [
            { firstName: { contains: searchQuery, mode: Prisma.QueryMode.insensitive } },
            { lastName: { contains: searchQuery, mode: Prisma.QueryMode.insensitive } },
            { email: { contains: searchQuery, mode: Prisma.QueryMode.insensitive } },
            { phone: { contains: searchQuery, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {};

  const [patients, staffUsers] = await Promise.all([
    prisma.patient.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        photoUrl: true,
        consents: {
          select: {
            type: true,
            status: true,
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
        email: { not: null },
      },
    }),
  ]);

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
  const getDisplayName = (p: typeof patients[number]) =>
    `${(p.lastName ?? "").trim()} ${(p.firstName ?? "").trim()}`.trim();
  const compareNames = (a: typeof patients[number], b: typeof patients[number]) => {
    const nameA = getDisplayName(a).toLowerCase();
    const nameB = getDisplayName(b).toLowerCase();
    if (nameA !== nameB) {
      return nameA.localeCompare(nameB, "it", { sensitivity: "base" });
    }
    return (a.createdAt?.getTime?.() ?? 0) - (b.createdAt?.getTime?.() ?? 0);
  };

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

  const paginatedPatients = sortedPatients.slice(skip, skip + PAGE_SIZE);

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
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Pazienti</p>
          <h1 className="text-2xl font-semibold text-zinc-900">Lista pazienti</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Cerca, filtra e apri le schede paziente esistenti.
          </p>
        </div>
        <Link
          href="/pazienti"
          className="inline-flex items-center rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700"
        >
          Torna alle sezioni
        </Link>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-zinc-900">Elenco pazienti</p>
          <p className="text-xs text-zinc-500">Ricerca, filtro e accesso rapido alle schede.</p>
        </div>
        <form className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3" method="get">
          <label className="flex flex-1 flex-col gap-2 text-sm font-medium text-zinc-800">
            Cerca
            <input
              type="text"
              name="q"
              defaultValue={qParam ?? ""}
              placeholder="Nome, cognome, email, telefono"
              className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="flex flex-1 flex-col gap-2 text-sm font-medium text-zinc-800 sm:max-w-xs">
            Ordina per
            <select
              name="sort"
              defaultValue={sortRaw ?? sortOption}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="name_asc">Alfabetico (A-Z)</option>
              <option value="name_desc">Alfabetico (Z-A)</option>
              <option value="date_desc">Data di inserimento (recenti)</option>
              <option value="date_asc">Data di inserimento (meno recenti)</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
            >
              Applica
            </button>
            <a
              href={`/pazienti/lista${sortOption ? `?sort=${sortOption}` : ""}`}
              className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700"
            >
              Mostra tutto
            </a>
          </div>
        </form>
        <div className="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
          {paginatedPatients.length === 0 ? (
            <p className="px-4 py-4 text-sm text-zinc-600">Nessun paziente registrato.</p>
          ) : (
            paginatedPatients.map((patient) => {
              const missingEmail = !patient.email;
              const missingPhone = !patient.phone;
              const missingCount = Number(missingEmail) + Number(missingPhone);
              const hasPrivacy =
                patient.consents?.some(
                  (c) => c.type === ConsentType.PRIVACY && c.status === ConsentStatus.GRANTED,
                ) ?? false;
              let badge: React.ReactNode = null;
              if (!hasPrivacy) {
                badge = (
                  <span title="Consenso privacy mancante" className="text-rose-600">
                    ▲
                  </span>
                );
              } else if (missingCount > 1) {
                badge = (
                  <span title="Dati di contatto mancanti" className="text-amber-500">
                    ⚠️
                  </span>
                );
              } else if (missingEmail) {
                badge = (
                  <span title="Email mancante" className="text-zinc-500">
                    📧
                  </span>
                );
              } else if (missingPhone) {
                badge = (
                  <span title="Telefono mancante" className="text-zinc-500">
                    ☎️
                  </span>
                );
              }

              return (
                <div key={patient.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-lg sm:hidden" aria-hidden={!badge}>
                    {badge}
                  </div>
                  <div className="flex flex-col">
                    <Link
                      href={`/pazienti/${patient.id}`}
                      className="text-sm font-semibold text-emerald-800 underline decoration-emerald-200 underline-offset-2"
                    >
                      <span className="mr-2 inline-flex items-center gap-1 align-middle">{badge}</span>
                      {patient.lastName} {patient.firstName}
                    </Link>
                    <span className="text-xs text-zinc-600">
                      {patient.email ?? "—"} · {patient.phone ?? "—"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    {patient.consents.map((consent) => (
                      <span
                        key={consent.type}
                        className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-emerald-800"
                      >
                        {consentLabels[consent.type] ?? consent.type}
                      </span>
                    ))}
                    <Link
                      href={`/pazienti/${patient.id}`}
                      className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:border-emerald-200 hover:text-emerald-700"
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
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          <p>
            Mostrati {totalCount === 0 ? "0" : `${showingFrom}-${Math.min(showingTo, totalCount)}`} di{" "}
            {totalCount}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={buildPageHref(page - 1)}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700"
              >
                ← Precedente
              </Link>
            ) : (
              <span className="rounded-full border border-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-400">
                ← Precedente
              </span>
            )}
            <span className="text-xs font-semibold text-zinc-600">
              Pagina {page} di {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={buildPageHref(page + 1)}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700"
              >
                Successiva →
              </Link>
            ) : (
              <span className="rounded-full border border-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-400">
                Successiva →
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
