import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role, AppointmentStatus, StockMovementType } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { FormSubmitButton } from "@/components/form-submit-button";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { DentalChart } from "@/components/dental-chart";

const conditionsList: string[] = [
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
];

const consentStatusLabels: Record<string, string> = {
  GRANTED: "Concesso",
  REVOKED: "Revocato",
  EXPIRED: "Scaduto",
};

const statusLabels: Record<AppointmentStatus, string> = {
  TO_CONFIRM: "Da confermare",
  CONFIRMED: "Confermato",
  IN_WAITING: "In attesa",
  IN_PROGRESS: "In corso",
  COMPLETED: "Completato",
  CANCELLED: "Annullato",
  NO_SHOW: "No-show",
};

const statusClasses: Record<AppointmentStatus, string> = {
  TO_CONFIRM: "border-amber-200 bg-amber-50 text-amber-800 shadow-sm",
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm",
  IN_WAITING: "border-zinc-200 bg-zinc-50 text-zinc-700 shadow-sm",
  IN_PROGRESS: "border-sky-200 bg-sky-50 text-sky-800 shadow-sm",
  COMPLETED: "border-green-200 bg-green-50 text-green-800 shadow-sm",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-800 shadow-sm",
  NO_SHOW: "border-slate-200 bg-slate-50 text-slate-700 shadow-sm",
};

async function updateAppointmentStatus(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const appointmentId = formData.get("appointmentId") as string;
  const patientId = formData.get("patientId") as string;
  const status = formData.get("status") as AppointmentStatus;

  if (!appointmentId || !status || !Object.keys(AppointmentStatus).includes(status)) {
    throw new Error("Dati aggiornamento non validi");
  }

  const current = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { status: true },
  });
  if (!current) throw new Error("Appuntamento non trovato");
  if (current.status === AppointmentStatus.COMPLETED && user.role !== Role.ADMIN) {
    throw new Error("Solo l'admin può modificare appuntamenti completati");
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status },
  });

  await logAudit(user, {
    action: "appointment.status_updated",
    entity: "Appointment",
    entityId: appointmentId,
    metadata: { status },
  });

  revalidatePath("/pazienti");
  if (patientId) {
    revalidatePath(`/pazienti/${patientId}`);
  }
}

async function addImplantAssociation(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const patientId = (formData.get("patientId") as string) || "";
  const productId = (formData.get("productId") as string) || "";
  const deviceType = (formData.get("deviceType") as string)?.trim() || null;
  const brand = (formData.get("brand") as string)?.trim() || null;
  const udiDi = (formData.get("udiDi") as string)?.trim() || null;
  const udiPi = (formData.get("udiPi") as string)?.trim() || null;
  const purchaseDateStr = (formData.get("purchaseDate") as string)?.trim();
  const interventionDateStr = (formData.get("interventionDate") as string)?.trim();
  const interventionSite = (formData.get("interventionSite") as string)?.trim() || null;

  if (!patientId || !productId) {
    throw new Error("Dati impianto non validi");
  }

  const purchaseDate = purchaseDateStr ? new Date(purchaseDateStr) : null;
  const interventionDate = interventionDateStr ? new Date(interventionDateStr) : null;

  await prisma.stockMovement.create({
    data: {
      productId,
      quantity: 1,
      movement: StockMovementType.OUT,
      note: [
        deviceType ? `Tipo: ${deviceType}` : null,
        brand ? `Marca: ${brand}` : null,
        udiDi ? `UDI-DI: ${udiDi}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
      patientId,
      udiPi,
      interventionSite,
      interventionDate: interventionDate && !Number.isNaN(interventionDate.getTime()) ? interventionDate : null,
      purchaseDate: purchaseDate && !Number.isNaN(purchaseDate.getTime()) ? purchaseDate : null,
    },
  });

  await logAudit(user, {
    action: "patient.implant_added",
    entity: "Patient",
    entityId: patientId,
    metadata: { productId, udiPi, brand, deviceType, interventionSite },
  });

  revalidatePath(`/pazienti/${patientId}`);
}

async function updateImplantAssociation(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const implantId = (formData.get("implantId") as string) || "";
  const patientId = (formData.get("patientId") as string) || "";
  const productId = (formData.get("productId") as string) || "";
  const deviceType = (formData.get("deviceType") as string)?.trim() || null;
  const brand = (formData.get("brand") as string)?.trim() || null;
  const udiDi = (formData.get("udiDi") as string)?.trim() || null;
  const udiPi = (formData.get("udiPi") as string)?.trim() || null;
  const purchaseDateStr = (formData.get("purchaseDate") as string)?.trim();
  const interventionDateStr = (formData.get("interventionDate") as string)?.trim();
  const interventionSite = (formData.get("interventionSite") as string)?.trim() || null;

  if (!implantId || !patientId || !productId) {
    throw new Error("Dati impianto non validi");
  }

  const purchaseDate = purchaseDateStr ? new Date(purchaseDateStr) : null;
  const interventionDate = interventionDateStr ? new Date(interventionDateStr) : null;

  await prisma.stockMovement.update({
    where: { id: implantId },
    data: {
      productId,
      note: [
        deviceType ? `Tipo: ${deviceType}` : null,
        brand ? `Marca: ${brand}` : null,
        udiDi ? `UDI-DI: ${udiDi}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
      udiPi,
      interventionSite,
      interventionDate: interventionDate && !Number.isNaN(interventionDate.getTime()) ? interventionDate : null,
      purchaseDate: purchaseDate && !Number.isNaN(purchaseDate.getTime()) ? purchaseDate : null,
    },
  });

  await logAudit(user, {
    action: "patient.implant_updated",
    entity: "Patient",
    entityId: patientId,
    metadata: { implantId, productId },
  });

  revalidatePath(`/pazienti/${patientId}`);
}
async function uploadPhoto(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);

  const patientId = formData.get("patientId") as string;
  const file = formData.get("photo") as File | null;

  if (!patientId || !file || file.size === 0) {
    throw new Error("File non valido");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const uploadDir = path.join(process.cwd(), "public", "uploads", "patients");
  await fs.mkdir(uploadDir, { recursive: true });

  const outputPath = path.join(uploadDir, `${patientId}.jpg`);
  const publicPath = `/uploads/patients/${patientId}.jpg?ts=${Date.now()}`;

  await sharp(buffer)
    .resize(512, 512, { fit: "cover" })
    .jpeg({ quality: 85 })
    .toFile(outputPath);

  await prisma.patient.update({
    where: { id: patientId },
    data: { photoUrl: publicPath },
  });

  await logAudit(user, {
    action: "patient.photo_uploaded",
    entity: "Patient",
    entityId: patientId,
    metadata: { size: file.size },
  });

  revalidatePath(`/pazienti/${patientId}`);
}

async function updatePatient(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);

  const id = (formData.get("patientId") as string) || "";
  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const conditions = formData
    .getAll("conditions")
    .map((c) => (c as string).trim())
    .filter(Boolean);
  const medications = (formData.get("medications") as string)?.trim() || null;
  const extraNotes = (formData.get("extraNotes") as string)?.trim() || null;
  const birthDateStr = (formData.get("birthDate") as string)?.trim();

  if (!id || !firstName || !lastName) {
    throw new Error("Dati paziente non validi");
  }

  const existing = await prisma.patient.findUnique({
    where: { id },
    select: { notes: true },
  });
  const existingLines =
    (existing?.notes ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean) ?? [];
  const preservedLines = existingLines.filter(
    (line) =>
      !line.startsWith("Anamnesi:") &&
      !line.startsWith("Farmaci:") &&
      !line.startsWith("Note:")
  );

  let birthDate: Date | null = null;
  if (birthDateStr) {
    const parsed = new Date(birthDateStr);
    birthDate = Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  await prisma.patient.update({
    where: { id },
    data: {
      firstName,
      lastName,
      email,
      phone,
      notes:
        [
          ...preservedLines,
          conditions.length ? `Anamnesi: ${conditions.join(", ")}` : null,
          medications ? `Farmaci: ${medications}` : null,
          extraNotes ? `Note: ${extraNotes}` : null,
        ]
          .filter(Boolean)
          .join("\n") || null,
      birthDate,
    },
  });

  await logAudit(user, {
    action: "patient.updated",
    entity: "Patient",
    entityId: id,
    metadata: {
      emailChanged: Boolean(email),
      patientName: `${firstName} ${lastName}`,
      conditions,
      medications,
      extraNotes,
      birthDate: birthDate?.toISOString() ?? null,
    },
  });

  revalidatePath(`/pazienti/${id}`);
  revalidatePath("/pazienti");
}

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id?: string }>;
}) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const isAdmin = user.role === Role.ADMIN;

  const resolvedParams = await params;
  const patientId = resolvedParams?.id;
  if (!patientId) {
    return notFound();
  }

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      consents: true,
      appointments: {
        orderBy: { startsAt: "desc" },
        take: 5,
        include: {
          doctor: { select: { fullName: true, specialty: true } },
        },
      },
    },
  });

  if (!patient) {
    return (
      <div className="order-2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-zinc-600">Paziente non trovato.</p>
        <Link
          href="/pazienti"
          className="mt-4 inline-flex rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-emerald-800"
        >
          Torna a Pazienti
        </Link>
      </div>
    );
  }

  const notesLines = (patient.notes ?? "").split("\n").map((line) => line.trim());
  const anamnesisLine = notesLines.find((line) => line.startsWith("Anamnesi:"));
  const parsedConditions = anamnesisLine
    ? anamnesisLine
        .replace("Anamnesi:", "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
    : [];
  const medicationsLine = notesLines.find((line) => line.startsWith("Farmaci:"));
  const parsedMedications = medicationsLine?.replace("Farmaci:", "").trim() ?? "";
  const extraLine = notesLines.find((line) => line.startsWith("Note:"));
  const parsedExtra = extraLine?.replace("Note:", "").trim() ?? "";

  const [products, implants, dentalRecords] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      include: { supplier: true },
    }),
    prisma.stockMovement.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      include: { product: { include: { supplier: true } } },
      take: 50,
    }),
    prisma.dentalRecord.findMany({
      where: { patientId },
      orderBy: { performedAt: "desc" },
    }),
  ]);
  const pastAppointments = patient.appointments
    .filter((appt) => appt.startsAt < new Date())
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  const dentalRecordsSerialized = dentalRecords.map((record) => ({
    ...record,
    performedAt: record.performedAt.toISOString(),
  }));

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-6">
          <details className="group rounded-2xl border border-zinc-200 bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl px-6 py-4 text-left">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-emerald-100 bg-emerald-50 text-lg font-semibold text-emerald-800">
                  {patient.photoUrl ? (
                    <Image
                      src={patient.photoUrl}
                      alt={`${patient.firstName} ${patient.lastName}`}
                      width={56}
                      height={56}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    `${(patient.firstName ?? "P")[0] ?? "P"}${(patient.lastName ?? " ")?.[0] ?? ""}`
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-zinc-600">Scheda paziente</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold text-zinc-900">
                      {patient.firstName} {patient.lastName}
                    </h1>
                    <p className="text-sm text-zinc-700">
                      {patient.email ?? "—"} · {patient.phone ?? "—"}
                    </p>
                  </div>
                </div>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-2xl font-semibold text-emerald-700 transition-transform duration-200 group-open:rotate-180">
                ⌄
              </span>
              <Link
                href="/pazienti"
                className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:border-emerald-300 hover:text-emerald-700"
              >
                ← Pazienti
              </Link>
            </summary>
            <div className="border-t border-zinc-200 px-6 pb-6 pt-4">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px,1fr]">
                <form
                  action={uploadPhoto}
                  className="flex flex-col items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-xs shadow-sm"
                  encType="multipart/form-data"
                >
                  <input type="hidden" name="patientId" value={patient.id} />
                  {patient.photoUrl ? (
                    <Image
                      src={patient.photoUrl}
                      alt={`${patient.firstName} ${patient.lastName}`}
                      width={112}
                      height={112}
                      className="h-28 w-28 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white text-2xl font-semibold text-emerald-800">
                      {`${(patient.firstName ?? "P")[0] ?? "P"}${(patient.lastName ?? " ")?.[0] ?? ""}`}
                    </div>
                  )}
                  <label className="flex cursor-pointer flex-col items-center gap-1 rounded-full bg-emerald-700 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-600">
                    <span>Carica foto</span>
                    <input
                      type="file"
                      name="photo"
                      accept="image/*"
                      className="hidden"
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    className="w-full rounded-full border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-800 transition hover:border-emerald-300"
                  >
                    Salva foto
                  </button>
                </form>

                <div className="space-y-6">
                  <form action={updatePatient} className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <input type="hidden" name="patientId" value={patient.id} />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-zinc-900">Modifica dati</p>
                      <p className="text-xs text-zinc-500">Aggiorna informazioni di contatto e note.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                        Nome
                        <input
                          name="firstName"
                          defaultValue={patient.firstName}
                          className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          required
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                        Cognome
                        <input
                          name="lastName"
                          defaultValue={patient.lastName}
                          className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          required
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                        Email
                        <input
                          name="email"
                          type="email"
                          defaultValue={patient.email ?? ""}
                          className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          placeholder="email@esempio.it"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                        Telefono
                        <input
                          name="phone"
                          defaultValue={patient.phone ?? ""}
                          className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          placeholder="+39..."
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
                        Data di nascita
                        <input
                          type="date"
                          name="birthDate"
                          defaultValue={
                            patient.birthDate
                              ? new Date(patient.birthDate).toISOString().split("T")[0]
                              : ""
                          }
                          className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        />
                      </label>
                      <div className="sm:col-span-2 rounded-lg border border-zinc-200 bg-white p-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-zinc-900">Anamnesi Generale</p>
                          <p className="text-xs text-zinc-500">
                            Seleziona eventuali condizioni mediche presenti o passate.
                          </p>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {conditionsList.map((condition) => (
                            <label
                              key={condition}
                              className="inline-flex items-start gap-2 rounded-lg px-2 py-1 text-sm text-zinc-800"
                            >
                              <input
                                type="checkbox"
                                name="conditions"
                                value={condition}
                                defaultChecked={parsedConditions.includes(condition)}
                                className="mt-1 h-4 w-4 rounded border-zinc-300"
                              />
                              <span>{condition}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
                        Farmaci
                        <textarea
                          name="medications"
                          defaultValue={parsedMedications}
                          rows={2}
                          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          placeholder="Farmaci assunti regolarmente"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
                        Note aggiuntive
                        <textarea
                          name="extraNotes"
                          defaultValue={parsedExtra}
                          rows={2}
                          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          placeholder="Annotazioni cliniche o amministrative"
                        />
                      </label>
                    </div>
                    <div className="flex justify-end">
                      <FormSubmitButton className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600">
                        Salva modifiche
                      </FormSubmitButton>
                    </div>
                  </form>

                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      Consensi
                    </p>
                    {patient.consents.length === 0 ? (
                      <p className="mt-2 text-sm text-zinc-600">Nessun consenso registrato.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {patient.consents.map((consent) => (
                          <div
                            key={consent.id}
                            className="flex flex-col gap-1 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold uppercase text-emerald-800">
                                {consent.type}
                              </span>
                              <span className="rounded-full bg-emerald-700 px-2 py-1 text-[11px] font-semibold uppercase text-white">
                                {consentStatusLabels[consent.status] ?? consent.status}
                              </span>
                              <span className="text-[11px] font-semibold text-emerald-900">
                                {new Date(consent.givenAt).toLocaleString("it-IT", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                              </span>
                            </div>
                            <div className="text-[11px] text-emerald-900">
                              Canale: {consent.channel ?? "—"}
                              {consent.expiresAt
                                ? ` · Scadenza: ${new Date(consent.expiresAt).toLocaleDateString("it-IT")}`
                                : ""}
                              {consent.revokedAt
                                ? ` · Revocato: ${new Date(consent.revokedAt).toLocaleDateString("it-IT")}`
                                : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </details>

          <DentalChart patientId={patient.id} initialRecords={dentalRecordsSerialized} />
        </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Associa impianti</h2>
        <p className="text-sm text-zinc-600">
          Registra impianti/protesi collegati al paziente utilizzando i dati di magazzino.
        </p>

        <div className="mt-4 space-y-4">
          <div className="overflow-hidden rounded-2xl border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="px-3 py-2 text-left">Tipo di DM</th>
                  <th className="px-3 py-2 text-left">Marca</th>
                  <th className="px-3 py-2 text-left">UDI-DI</th>
                  <th className="px-3 py-2 text-left">UDI-PI</th>
                  <th className="px-3 py-2 text-left">Data acquisto</th>
                  <th className="px-3 py-2 text-left">Data intervento</th>
                  <th className="px-3 py-2 text-left">Sede intervento</th>
                  <th className="px-3 py-2 text-left">Modifica</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {implants.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-sm text-zinc-600" colSpan={8}>
                      Nessun impianto associato.
                    </td>
                  </tr>
                ) : (
                  implants.map((imp) => {
                    const note = imp.note ?? "";
                    const deviceType = note.match(/Tipo:\s*([^·]+)/)?.[1]?.trim() ?? imp.product?.name ?? "—";
                    const brandFromNote = note.match(/Marca:\s*([^·]+)/)?.[1]?.trim();
                    const udiDiFromNote = note.match(/UDI-DI:\s*([^·]+)/)?.[1]?.trim();
                    const brand =
                      brandFromNote ?? imp.product?.supplier?.name ?? (imp.product?.name ? "—" : "—");
                    return (
                      <tr key={imp.id} className="hover:bg-zinc-50">
                        <td className="px-3 py-2 text-zinc-900">{deviceType}</td>
                        <td className="px-3 py-2 text-zinc-700">{brand ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs text-zinc-600">
                          {udiDiFromNote ?? imp.product?.udiDi ?? "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-zinc-600">{imp.udiPi ?? "—"}</td>
                        <td className="px-3 py-2 text-zinc-700">
                          {imp.purchaseDate
                            ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(imp.purchaseDate)
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-zinc-700">
                          {imp.interventionDate
                            ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(imp.interventionDate)
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-zinc-700">{imp.interventionSite ?? "—"}</td>
                        <td className="px-3 py-2">
                          <details className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 shadow-sm">
                            <summary className="cursor-pointer font-semibold text-emerald-800">Modifica</summary>
                            <form action={updateImplantAssociation} className="mt-2 grid grid-cols-1 gap-2">
                              <input type="hidden" name="implantId" value={imp.id} />
                              <input type="hidden" name="patientId" value={patient.id} />
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                Prodotto
                                <select
                                  name="productId"
                                  defaultValue={imp.productId}
                                  className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                >
                                  {products.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} {p.supplier?.name ? `· ${p.supplier.name}` : ""} {p.udiDi ? `· ${p.udiDi}` : ""}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                Tipo DM
                                <input
                                  name="deviceType"
                                  defaultValue={deviceType !== "—" ? deviceType : ""}
                                  className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                Marca
                                <input
                                  name="brand"
                                  defaultValue={brand ?? ""}
                                  className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                UDI-DI
                                <input
                                  name="udiDi"
                                  defaultValue={udiDiFromNote ?? imp.product?.udiDi ?? ""}
                                  className="h-9 rounded-lg border border-zinc-200 px-2 font-mono text-xs text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                  placeholder="UDI-DI"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                UDI-PI
                                <input
                                  name="udiPi"
                                  defaultValue={imp.udiPi ?? ""}
                                  className="h-9 rounded-lg border border-zinc-200 px-2 font-mono text-xs text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                Data acquisto
                                <input
                                  type="date"
                                  name="purchaseDate"
                                  defaultValue={
                                    imp.purchaseDate ? imp.purchaseDate.toISOString().split("T")[0] : ""
                                  }
                                  className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                Data intervento
                                <input
                                  type="date"
                                  name="interventionDate"
                                  defaultValue={
                                    imp.interventionDate ? imp.interventionDate.toISOString().split("T")[0] : ""
                                  }
                                  className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-700">
                                Sede
                                <input
                                  name="interventionSite"
                                  defaultValue={imp.interventionSite ?? ""}
                                  className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                />
                              </label>
                              <div className="flex justify-end pt-1">
                                <button
                                  type="submit"
                                  className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-600"
                                >
                                  Salva
                                </button>
                              </div>
                            </form>
                          </details>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <details className="group rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:border-emerald-200 hover:bg-emerald-50">
              <span>Collega un nuovo impianto</span>
              <span className="text-xs font-medium text-emerald-700 group-open:hidden">Mostra modulo</span>
              <span className="text-xs font-medium text-emerald-700 hidden group-open:inline">Nascondi</span>
            </summary>
            <form action={addImplantAssociation} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input type="hidden" name="patientId" value={patient.id} />
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Prodotto / Tipo di DM
                <select
                  name="productId"
                  className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Seleziona prodotto
                  </option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.supplier?.name ? `· ${p.supplier.name}` : ""} {p.udiDi ? `· ${p.udiDi}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Marca
                <input
                  name="brand"
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Marca"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Tipo di DM (personalizzato)
                <input
                  name="deviceType"
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Es. Impianto, Protesi..."
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Codice UDI-DI
                <input
                  name="udiDi"
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="UDI-DI"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Codice UDI-PI
                <input
                  name="udiPi"
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="UDI-PI / Lotto"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Data acquisto
                <input
                  type="date"
                  name="purchaseDate"
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Data intervento
                <input
                  type="date"
                  name="interventionDate"
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
                Sede intervento
                <input
                  name="interventionSite"
                  className="h-11 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Es. 1.1, 2.4..."
                />
              </label>
              <div className="sm:col-span-2 flex justify-end">
                <FormSubmitButton className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600">
                  Associa impianto
                </FormSubmitButton>
              </div>
            </form>
          </details>
        </div>
      </div>
    </div>

    <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Storico appuntamenti</h2>
          <p className="text-sm text-zinc-600">Solo lettura, per tracciare gli ultimi appuntamenti.</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          {pastAppointments.length}
        </span>
      </div>
      <div className="mt-4 divide-y divide-zinc-100">
        {pastAppointments.length === 0 ? (
          <p className="py-4 text-sm text-zinc-600">Nessun appuntamento passato.</p>
        ) : (
          pastAppointments.slice(0, 5).map((appt) => (
            <div
              key={appt.id}
              className="py-4 first:pt-2 last:pb-2"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                      <span aria-hidden="true">
                        {(appt.serviceType ?? "").toLowerCase().includes("odo") ||
                        (appt.doctor?.specialty ?? "").toLowerCase().includes("odo")
                          ? "🦷"
                          : "❤️"}
                      </span>
                      {appt.title}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-700">
                      {appt.serviceType}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-800">
                    🧑‍⚕️ Paziente {patient.firstName} {patient.lastName} è stato visto da{" "}
                    <span className="font-semibold">{appt.doctor?.fullName ?? "—"}</span>{" "}
                    {appt.doctor?.specialty ? `(${appt.doctor.specialty})` : ""} il{" "}
                    {new Intl.DateTimeFormat("it-IT", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(appt.startsAt)}{" "}
                    alle {new Intl.DateTimeFormat("it-IT", { timeStyle: "short" }).format(appt.startsAt)}.
                  </p>
                  <p className="text-sm text-zinc-800">
                    🕒 Terminato previsto entro{" "}
                    {new Intl.DateTimeFormat("it-IT", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(appt.endsAt)}{" "}
                    alle {new Intl.DateTimeFormat("it-IT", { timeStyle: "short" }).format(appt.endsAt)}.
                  </p>
                </div>
                <span
                  className={`mt-1 inline-flex h-8 items-center rounded-full px-3 text-[11px] font-semibold uppercase ${statusClasses[appt.status]}`}
                >
                  {statusLabels[appt.status].toUpperCase()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
    </>
  );
}
