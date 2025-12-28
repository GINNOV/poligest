import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Prisma, Role, ConsentType, ConsentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { PatientDeleteButton } from "@/components/patient-delete-button";
import { PatientConsentSection } from "@/components/patient-consent-modal";
import { LocalizedFileInput } from "@/components/localized-file-input";
import { normalizeItalianPhone } from "@/lib/phone";
import { parseOptionalDate } from "@/lib/date";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { put } from "@vercel/blob";
import { sendEmail } from "@/lib/email";
import { stackServerApp } from "@/lib/stack-app";

const PAGE_SIZE = 20;

const consentLabels: Partial<Record<ConsentType, string>> = {
  [ConsentType.PRIVACY]: "Privacy",
  [ConsentType.TREATMENT]: "Trattamento",
};

function withParam(url: string, key: string, value: string) {
  const hasQuery = url.includes("?");
  const separator = hasQuery ? "&" : "?";
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function normalizeSiteOrigin(rawOrigin: string | undefined) {
  if (!rawOrigin) {
    return "";
  }
  if (/^https?:\/\//.test(rawOrigin)) {
    return rawOrigin.replace(/\/$/, "");
  }
  return `https://${rawOrigin.replace(/\/$/, "")}`;
}

function resolveSiteOrigin() {
  if (process.env.NODE_ENV === "production") {
    return normalizeSiteOrigin(
      process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.VERCEL_URL,
    );
  }
  return normalizeSiteOrigin(process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL);
}

async function createPatient(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);

  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase() || null;
  const phone = normalizeItalianPhone((formData.get("phone") as string) ?? null);
  const address = (formData.get("address") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim() || null;
  const taxId = (formData.get("taxId") as string)?.trim() || null;
  const birthDateValue = formData.get("birthDate");
  const conditions = formData.getAll("conditions").map((c) => (c as string).trim()).filter(Boolean);
  const medications = (formData.get("medications") as string)?.trim();
  const extraNotes = (formData.get("extraNotes") as string)?.trim();
  const consentPlace = (formData.get("consentPlace") as string)?.trim();
  const consentDate = (formData.get("consentDate") as string)?.trim();
  const patientSignature = (formData.get("patientSignature") as string)?.trim();
  const doctorSignature = (formData.get("doctorSignature") as string)?.trim();
  const consentSignatureData = (formData.get("consentSignatureData") as string)?.trim();
  const photo = formData.get("photo") as File | null;

  const signatureBase64 = consentSignatureData?.startsWith("data:image/png")
    ? consentSignatureData.replace(/^data:image\/png;base64,/, "")
    : null;
  const signatureBuffer = signatureBase64 ? Buffer.from(signatureBase64, "base64") : null;

  const birthDate = parseOptionalDate(birthDateValue);

  if (!firstName || !lastName) {
    throw new Error("Nome e cognome sono obbligatori");
  }
  if (!signatureBuffer) {
    throw new Error("Firma digitale obbligatoria");
  }
  if (!patientSignature) {
    throw new Error("Firma del paziente obbligatoria (nome leggibile).");
  }

  const structuredNotesText = [
    address || city ? `Indirizzo: ${address ?? "—"}${city ? `, ${city}` : ""}` : null,
    taxId ? `Codice Fiscale: ${taxId}` : null,
    conditions.length > 0 ? `Anamnesi: ${conditions.join(", ")}` : null,
    medications ? `Farmaci: ${medications}` : null,
    extraNotes ? `Note aggiuntive: ${extraNotes}` : null,
    `Consenso firmato${consentPlace ? ` a ${consentPlace}` : ""}${consentDate ? ` il ${consentDate}` : ""}. ` +
      `Firma paziente: ${patientSignature || "—"} · Firma medico: ${doctorSignature || "—"}`,
    signatureBuffer ? "Firma digitale acquisita." : "Firma digitale non acquisita.",
  ]
    .filter(Boolean)
    .join("\n");

  const patient = await prisma.patient.create({
    data: {
      firstName,
      lastName,
      email,
      phone,
      birthDate,
      notes: structuredNotesText || null,
      consents: {
        create: [
          {
            type: ConsentType.PRIVACY,
            status: ConsentStatus.GRANTED,
            channel: "form",
          },
          {
            type: ConsentType.TREATMENT,
            status: ConsentStatus.GRANTED,
            channel: "form",
          },
        ] as {
          type: ConsentType;
          status: ConsentStatus;
          channel: string;
        }[],
      },
    },
  });

  const updates: {
    notes: string | null;
    photoUrl?: string;
  } = { notes: structuredNotesText || null };

  if (photo && photo.size > 0) {
    const buffer = Buffer.from(await photo.arrayBuffer());
    const resized = await sharp(buffer)
      .resize(512, 512, { fit: "cover" })
      .jpeg({ quality: 85 })
      .toBuffer();
    const blobName = `patients/${patient.id}/photo-${Date.now()}.jpg`;
    const blob = await put(blobName, resized, { access: "public", addRandomSuffix: false });
    updates.photoUrl = blob.url;
  }

  if (signatureBuffer) {
    const signatureName = `signatures/${patient.id}/signature-${Date.now()}.png`;
    const signatureBlob = await put(signatureName, signatureBuffer, { access: "public", addRandomSuffix: false });
    updates.notes = `${structuredNotesText}\nFirma digitale: ${signatureBlob.url}`;
  }

  await prisma.patient.update({
    where: { id: patient.id },
    data: updates,
  });

  await logAudit(user, {
    action: "patient.created",
    entity: "Patient",
    entityId: patient.id,
    metadata: {
      patientName: `${patient.firstName} ${patient.lastName}`,
      consentAgreement: true,
      taxIdProvided: Boolean(taxId),
      conditionsCount: conditions.length,
      hasDigitalSignature: Boolean(signatureBuffer),
    },
  });

  if (email) {
    const signInUrl = stackServerApp.urls.signIn ?? "/handler/sign-in";
    const patientSignInUrl = withParam(signInUrl, "audience", "patient");
    const siteOrigin = resolveSiteOrigin();
    const loginUrl = /^https?:\/\//.test(patientSignInUrl)
      ? patientSignInUrl
      : siteOrigin
        ? `${siteOrigin}${patientSignInUrl}`
        : patientSignInUrl;
    const subject = "Accesso area pazienti";
    const body = `Ciao ${firstName},

Abbiamo creato il tuo profilo paziente. Accedi qui per visualizzare e gestire gli appuntamenti:
${loginUrl}

Se hai bisogno di assistenza, contatta la segreteria.`;
    await sendEmail(email, subject, body);
  }

  revalidatePath("/pazienti");
}

export default async function PazientiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined> | URLSearchParams>;
}) {
  const rawParams = await searchParams;
  // Normalize Next searchParams (can be a plain object or URLSearchParams in newer releases).
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

  const [patients, totalCount] = await Promise.all([
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
    prisma.patient.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * PAGE_SIZE;
  const getDisplayName = (p: typeof patients[number]) =>
    `${(p.firstName ?? "").trim()} ${(p.lastName ?? "").trim()}`.trim();
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
      ? [...patients].sort((a, b) => (sortOption === "name_desc" ? -compareNames(a, b) : compareNames(a, b)))
      : [...patients].sort((a, b) =>
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
    return `/pazienti?${query.toString()}`;
  };
  const doctors = await prisma.doctor.findMany({
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true },
  });
  const privacyContent = await fs.readFile(
    path.join(process.cwd(), "AI", "CONTENT", "Patient_Privacy.md"),
    "utf8",
  );

  return (
    <div className="grid grid-cols-1 gap-6">
      <details className="rounded-2xl border border-zinc-200 bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              ➕
            </span>
            <div>
              <h1 className="text-lg font-semibold text-zinc-900">Modulo di Registrazione Paziente</h1>
              <p className="text-sm text-zinc-600">
                Compila per creare una nuova scheda paziente, includendo consenso e firma digitale.
              </p>
            </div>
          </div>
          <span className="text-sm font-semibold text-emerald-700">Crea nuovo</span>
        </summary>

        <UnsavedChangesGuard formId="patient-create-form" />
        <form action={createPatient} className="space-y-6 px-6 pb-6" id="patient-create-form">
          <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-zinc-900">Dati Personali</p>
              <p className="text-xs text-zinc-500">Informazioni personali del paziente.</p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                Cognome
                <input
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  name="lastName"
                  required
                  autoComplete="family-name"
                  placeholder="Cognome"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                Nome
                <input
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  name="firstName"
                  required
                  autoComplete="given-name"
                  placeholder="Nome"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
                Indirizzo
                <input
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  name="address"
                  autoComplete="street-address"
                  placeholder="Via, Numero Civico"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                Città
                <input
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  name="city"
                  autoComplete="address-level2"
                  placeholder="Città"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                Telefono
                <input
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  name="phone"
                  autoComplete="tel"
                  placeholder="Telefono"
                  required
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                Email
                <input
                  type="email"
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  name="email"
                  autoComplete="email"
                  placeholder="email@esempio.it"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                Codice Fiscale
                <input
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 uppercase outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  name="taxId"
                  placeholder="Codice Fiscale"
                  maxLength={16}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                Data di Nascita
                <input
                  type="date"
                  name="birthDate"
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="dd/mm/yyyy"
                />
              </label>
              <div className="flex flex-col gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
                <span>Foto (opzionale)</span>
                <LocalizedFileInput
                  name="photo"
                  accept="image/*"
                  helperText="L'immagine verrà ridimensionata automaticamente a 512x512."
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-zinc-900">Anamnesi Generale</p>
              <p className="text-xs text-zinc-500">
                Seleziona eventuali condizioni mediche presenti o passate.
              </p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                "Artrosi cardiache",
                "Ipertensione arteriosa",
                "Malattie renali",
                "Malattie oculari",
                "Malattie ematiche",
                "Diabete",
                "Asma/Allergie",
                "Farmacoterapia",
                "Operazioni chirurgiche",
                "Fumatore",
                "Malattie infettive (es. Epatite, HIV)",
                "Malattie epatiche",
                "Malattie reumatiche",
                "Anomalie della coagulazione",
                "Gravidanza",
              ].map((condition) => (
                <label key={condition} className="inline-flex items-start gap-2 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    name="conditions"
                    value={condition}
                    className="mt-1 h-4 w-4 rounded border-zinc-300"
                  />
                  <span>{condition}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                Specificare eventuali farmaci assunti regolarmente
                <textarea
                  name="medications"
                  className="min-h-[90px] rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Elenca farmaci e dosaggi"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                Note aggiuntive
                <textarea
                  name="extraNotes"
                  className="min-h-[90px] rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Annotazioni utili per il medico"
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 sm:p-5">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-emerald-900">Consenso e firma digitale</p>
              <p className="text-xs text-emerald-700">
                Leggi l&apos;informativa e acquisisci la firma digitale del paziente.
              </p>
            </div>
            <div className="mt-3 rounded-lg border border-emerald-200 bg-white">
              <PatientConsentSection content={privacyContent} doctors={doctors} />
            </div>
          </section>
        </form>
      </details>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Elenco pazienti</h2>
        <form className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3" method="get">
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
              href={`/pazienti${sortOption ? `?sort=${sortOption}` : ""}`}
              className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700"
            >
              Mostra tutto
            </a>
          </div>
        </form>
        <div className="mt-4 divide-y divide-zinc-100">
          {paginatedPatients.length === 0 ? (
            <p className="py-4 text-sm text-zinc-600">Nessun paziente registrato.</p>
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
                      {patient.firstName} {patient.lastName}
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
      </div>
    </div>
  );
}
