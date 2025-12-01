import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

async function uploadPhoto(formData: FormData) {
  "use server";

  await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);

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
}

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id?: string }>;
}) {
  await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);

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
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr,0.9fr]">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-zinc-600">Scheda paziente</p>
            <h1 className="text-2xl font-semibold text-zinc-900">
              {patient.firstName} {patient.lastName}
            </h1>
            <p className="mt-1 text-sm text-zinc-700">
              {patient.email ?? "—"} · {patient.phone ?? "—"}
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <form
              action={uploadPhoto}
              className="flex flex-col items-center gap-2 text-xs"
              encType="multipart/form-data"
            >
              <input type="hidden" name="patientId" value={patient.id} />
              {patient.photoUrl ? (
                <Image
                  src={patient.photoUrl}
                  alt={`${patient.firstName} ${patient.lastName}`}
                  width={96}
                  height={96}
                  className="h-24 w-24 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-50 text-xl font-semibold text-emerald-800">
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
                className="rounded-full border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-800 transition hover:border-emerald-300"
              >
                Salva foto
              </button>
            </form>
          </div>
          <Link
            href="/pazienti"
            className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:border-emerald-300 hover:text-emerald-700"
          >
            ← Pazienti
          </Link>
        </div>

        <div className="mt-6 space-y-3">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Consensi
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {patient.consents.length === 0 ? (
                <span className="text-zinc-500">Nessun consenso registrato.</span>
              ) : (
                patient.consents.map((consent) => (
                  <span
                    key={consent.id}
                    className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 font-semibold text-emerald-800"
                  >
                    {consent.type} · {consent.status}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Ultimi appuntamenti</h2>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            {patient.appointments.length}
          </span>
        </div>
        <div className="mt-4 divide-y divide-zinc-100">
          {patient.appointments.length === 0 ? (
            <p className="py-4 text-sm text-zinc-600">Nessun appuntamento recente.</p>
          ) : (
            patient.appointments.map((appt) => (
              <div key={appt.id} className="flex flex-col gap-1 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-900">
                    {appt.title}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase ${
                      appt.status === "CONFIRMED"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : appt.status === "COMPLETED"
                        ? "border-green-200 bg-green-50 text-green-800"
                        : appt.status === "CANCELLED"
                        ? "border-rose-200 bg-rose-50 text-rose-800"
                        : appt.status === "IN_PROGRESS"
                        ? "border-sky-200 bg-sky-50 text-sky-800"
                        : appt.status === "TO_CONFIRM"
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-zinc-200 bg-zinc-50 text-zinc-700"
                    }`}
                  >
                    {appt.status.toUpperCase()}
                  </span>
                </div>
                <span className="text-xs text-zinc-600">
                  {appt.doctor?.fullName ?? "—"} {appt.doctor?.specialty ? `(${appt.doctor.specialty})` : ""}
                </span>
                <span className="text-xs text-zinc-600">
                  {new Date(appt.startsAt).toLocaleString("it-IT", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
