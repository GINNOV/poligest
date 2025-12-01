import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { Role, ConsentType, ConsentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

async function createPatient(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);

  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const email = (formData.get("email") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const photo = formData.get("photo") as File | null;
  const consentPrivacy = formData.get("consentPrivacy") === "on";
  const consentTreatment = formData.get("consentTreatment") === "on";

  if (!firstName || !lastName) {
    throw new Error("Nome e cognome sono obbligatori");
  }

  const patient = await prisma.patient.create({
    data: {
      firstName,
      lastName,
      email,
      phone,
      consents: {
        create: [
          consentPrivacy
            ? {
                type: ConsentType.PRIVACY,
                status: ConsentStatus.GRANTED,
                channel: "form",
              }
            : null,
          consentTreatment
            ? {
                type: ConsentType.TREATMENT,
                status: ConsentStatus.GRANTED,
                channel: "form",
              }
            : null,
        ].filter(Boolean) as {
          type: ConsentType;
          status: ConsentStatus;
          channel: string;
        }[],
      },
    },
  });

  if (photo && photo.size > 0) {
    const buffer = Buffer.from(await photo.arrayBuffer());
    const uploadDir = path.join(process.cwd(), "public", "uploads", "patients");
    await fs.mkdir(uploadDir, { recursive: true });
    const outputPath = path.join(uploadDir, `${patient.id}.jpg`);
    const publicPath = `/uploads/patients/${patient.id}.jpg?ts=${Date.now()}`;

    await sharp(buffer)
      .resize(512, 512, { fit: "cover" })
      .jpeg({ quality: 85 })
      .toFile(outputPath);

    await prisma.patient.update({
      where: { id: patient.id },
      data: { photoUrl: publicPath },
    });
  }

  await logAudit(user, {
    action: "patient.created",
    entity: "Patient",
    entityId: patient.id,
    metadata: { consentPrivacy, consentTreatment },
  });

  revalidatePath("/pazienti");
}

async function deletePatient(formData: FormData) {
  "use server";

  await requireUser([Role.ADMIN]);
  const patientId = formData.get("patientId") as string;
  if (!patientId) throw new Error("Paziente non valido");

  await prisma.patient.delete({ where: { id: patientId } });
  revalidatePath("/pazienti");
}

export default async function PazientiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const t = await getTranslations("patients");

  const qParam = params.q;
  const searchQuery =
    typeof qParam === "string"
      ? qParam.toLowerCase()
      : Array.isArray(qParam)
        ? qParam[0]?.toLowerCase()
        : undefined;

  const patients = await prisma.patient.findMany({
    orderBy: { createdAt: "desc" },
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
    where: searchQuery
      ? {
          OR: [
            { firstName: { contains: searchQuery, mode: "insensitive" } },
            { lastName: { contains: searchQuery, mode: "insensitive" } },
            { email: { contains: searchQuery, mode: "insensitive" } },
            { phone: { contains: searchQuery, mode: "insensitive" } },
          ],
        }
      : undefined,
  });

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">{t("title")}</h1>
        <p className="mt-2 text-sm text-zinc-600">{t("subtitle")}</p>

        <form
          action={createPatient}
          className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2"
          encType="multipart/form-data"
        >
          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            Nome
            <input
              className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              name="firstName"
              required
              autoComplete="given-name"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            Cognome
            <input
              className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              name="lastName"
              required
              autoComplete="family-name"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            Email
            <input
              className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              type="email"
              name="email"
              autoComplete="email"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            Telefono
            <input
              className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              name="phone"
              autoComplete="tel"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            Foto (opzionale)
            <input
              type="file"
              name="photo"
              accept="image/*"
              className="h-11 rounded-xl border border-dashed border-emerald-200 px-3 text-sm text-zinc-900 outline-none transition file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-emerald-800 hover:border-emerald-300"
            />
            <span className="text-xs font-normal text-zinc-500">
              Verrà ridimensionata automaticamente a 512x512.
            </span>
          </label>
          <div className="col-span-full flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800">
            <span className="font-semibold text-zinc-900">Consensi</span>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" name="consentPrivacy" className="h-4 w-4 rounded border-zinc-300" />
              Privacy
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" name="consentTreatment" className="h-4 w-4 rounded border-zinc-300" />
              Trattamento sanitario
            </label>
          </div>
          <div className="col-span-full">
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
            >
              Aggiungi paziente
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Elenco pazienti</h2>
        <form className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3" method="get">
          <label className="flex flex-1 flex-col gap-2 text-sm font-medium text-zinc-800">
            Cerca
            <input
              type="text"
              name="q"
              defaultValue={
                typeof params.q === "string"
                  ? params.q
                  : Array.isArray(params.q)
                    ? params.q[0]
                    : ""
              }
              placeholder="Nome, cognome, email, telefono"
              className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
            >
              Applica
            </button>
            <a
              href="/pazienti"
              className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700"
            >
              Mostra tutto
            </a>
          </div>
        </form>
        <div className="mt-4 divide-y divide-zinc-100">
          {patients.length === 0 ? (
            <p className="py-4 text-sm text-zinc-600">Nessun paziente registrato.</p>
          ) : (
            patients.map((patient) => (
              <div key={patient.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col">
                  <Link
                    href={`/pazienti/${patient.id}`}
                    className="text-sm font-semibold text-emerald-800 underline decoration-emerald-200 underline-offset-2"
                  >
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
                      {consent.type}
                    </span>
                  ))}
                  <Link
                    href={`/pazienti/${patient.id}`}
                    className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:border-emerald-200 hover:text-emerald-700"
                  >
                    Scheda / Foto
                  </Link>
                  <form action={deletePatient}>
                    <input type="hidden" name="patientId" value={patient.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-rose-200 px-3 py-1 text-rose-700 transition hover:border-rose-300 hover:text-rose-800"
                    >
                      Elimina
                    </button>
                  </form>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
