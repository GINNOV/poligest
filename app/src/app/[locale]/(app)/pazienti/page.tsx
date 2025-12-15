import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Role, ConsentType, ConsentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { PatientDeleteButton } from "@/components/patient-delete-button";
import { PatientConsentSection } from "@/components/patient-consent-modal";

const consentLabels: Partial<Record<ConsentType, string>> = {
  [ConsentType.PRIVACY]: "Privacy",
  [ConsentType.TREATMENT]: "Trattamento",
};

async function createPatient(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);

  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim() || null;
  const address = (formData.get("address") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim() || null;
  const taxId = (formData.get("taxId") as string)?.trim() || null;
  const birthDateStr = (formData.get("birthDate") as string)?.trim();
  const conditions = formData.getAll("conditions").map((c) => (c as string).trim()).filter(Boolean);
  const medications = (formData.get("medications") as string)?.trim();
  const extraNotes = (formData.get("extraNotes") as string)?.trim();
  const consentAgreement = formData.get("consentAgreement") === "on";
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

  let birthDate: Date | null = null;
  if (birthDateStr) {
    const parsed = new Date(birthDateStr);
    if (!isNaN(parsed.getTime())) {
      birthDate = parsed;
    }
  }

  if (!firstName || !lastName) {
    throw new Error("Nome e cognome sono obbligatori");
  }
  if (!signatureBuffer) {
    throw new Error("Firma digitale obbligatoria");
  }

  const structuredNotesText = [
    address || city ? `Indirizzo: ${address ?? "—"}${city ? `, ${city}` : ""}` : null,
    taxId ? `Codice Fiscale: ${taxId}` : null,
    conditions.length > 0 ? `Anamnesi: ${conditions.join(", ")}` : null,
    medications ? `Farmaci: ${medications}` : null,
    extraNotes ? `Note aggiuntive: ${extraNotes}` : null,
    consentAgreement
      ? `Consenso firmato${consentPlace ? ` a ${consentPlace}` : ""}${consentDate ? ` il ${consentDate}` : ""}. ` +
        `Firma paziente: ${patientSignature || "—"} · Firma medico: ${doctorSignature || "—"}`
      : "Consenso non fornito",
    signatureBuffer ? "Firma digitale acquisita." : "Firma digitale non acquisita.",
  ]
    .filter(Boolean)
    .join("\n");

  const patient = await prisma.patient.create({
    data: {
      firstName,
      lastName,
      phone,
      birthDate,
      notes: structuredNotesText || null,
      consents: {
        create: [
          consentAgreement
            ? {
                type: ConsentType.PRIVACY,
                status: ConsentStatus.GRANTED,
                channel: "form",
              }
            : null,
          consentAgreement
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

  const updates: Record<string, any> = {
    notes: structuredNotesText || null,
  };

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

    updates.photoUrl = publicPath;
  }

  if (signatureBuffer) {
    const signatureDir = path.join(process.cwd(), "public", "uploads", "signatures");
    await fs.mkdir(signatureDir, { recursive: true });
    const signaturePath = path.join(signatureDir, `${patient.id}.png`);
    await fs.writeFile(signaturePath, signatureBuffer);
    const signaturePublicPath = `/uploads/signatures/${patient.id}.png?ts=${Date.now()}`;
    updates.notes = `${structuredNotesText}\nFirma digitale: ${signaturePublicPath}`;
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
      consentAgreement,
      taxIdProvided: Boolean(taxId),
      conditionsCount: conditions.length,
      hasDigitalSignature: Boolean(signatureBuffer),
    },
  });

  revalidatePath("/pazienti");
}

export default async function PazientiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);

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
  const privacyContent = await fs.readFile(
    path.join(process.cwd(), "AI", "CONTENT", "Patient_Privacy.md"),
    "utf8",
  );

  return (
    <div className="grid grid-cols-1 gap-6">
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
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">Modulo di Registrazione Paziente</h1>
          <p className="text-sm text-zinc-600">Si prega di compilare tutti i campi con attenzione.</p>
        </div>

        <form action={createPatient} className="mt-6 space-y-6">
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
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
                Foto (opzionale)
                <input
                  type="file"
                  name="photo"
                  accept="image/*"
                  className="h-11 rounded-lg border border-dashed border-emerald-200 px-3 text-sm text-zinc-900 outline-none transition file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-emerald-800 hover:border-emerald-300"
                />
                <span className="text-xs font-normal text-zinc-500">
                  L&apos;immagine verrà ridimensionata automaticamente a 512x512.
                </span>
              </label>
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

          <PatientConsentSection content={privacyContent} />
        </form>
      </div>
    </div>
  );
}
