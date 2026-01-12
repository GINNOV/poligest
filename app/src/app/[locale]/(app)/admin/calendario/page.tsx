import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Role } from "@prisma/client";
import { AdminDoctorAvailabilityEditor } from "@/components/admin-doctor-availability-editor";

type PracticeClosureType = "HOLIDAY" | "TIME_OFF";
const PRACTICE_CLOSURE_TYPES: PracticeClosureType[] = ["HOLIDAY", "TIME_OFF"];

type AvailabilityWindowRow = {
  id: string;
  doctorId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  color: string | null;
};

type PracticeClosureRow = {
  id: string;
  type: PracticeClosureType;
  title: string | null;
  startsAt: Date;
  endsAt: Date;
};

type PracticeWeeklyClosureRow = {
  id: string;
  dayOfWeek: number;
  title: string | null;
  isActive: boolean;
};

type CrudClient = {
  create?: (args: unknown) => Promise<unknown>;
  update?: (args: unknown) => Promise<unknown>;
  delete?: (args: unknown) => Promise<unknown>;
  findMany?: (args: unknown) => Promise<unknown[]>;
};

const prismaModels = prisma as unknown as Record<string, unknown>;
const availabilityClient = prismaModels["doctorAvailabilityWindow"] as CrudClient | undefined;
const closureClient = prismaModels["practiceClosure"] as CrudClient | undefined;
const weeklyClosureClient = prismaModels["practiceWeeklyClosure"] as CrudClient | undefined;

const WEEKDAYS: Array<{ value: number; label: string }> = [
  { value: 1, label: "Lunedì" },
  { value: 2, label: "Martedì" },
  { value: 3, label: "Mercoledì" },
  { value: 4, label: "Giovedì" },
  { value: 5, label: "Venerdì" },
  { value: 6, label: "Sabato" },
  { value: 7, label: "Domenica" },
];

function parseDayOfWeek(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 7) {
    throw new Error("Giorno della settimana non valido.");
  }
  return parsed;
}

function parseTimeToMinutes(value: unknown) {
  const raw = String(value ?? "").trim();
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(raw);
  if (!match) throw new Error("Orario non valido (usa HH:MM).");
  return Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10);
}

function normalizeHexColor(value: unknown) {
  const raw = String(value ?? "").trim();
  const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(raw);
  if (!match) throw new Error("Colore non valido.");
  const hex = match[1].toLowerCase();
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }
  return `#${hex}`;
}

function formatLocalInput(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

async function createAvailabilityWindow(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
  if (!availabilityClient?.create) {
    throw new Error("Disponibilità non configurata. Esegui migrazioni Prisma e rigenera il client.");
  }

  const doctorId = (formData.get("doctorId") as string) || "";
  const dayOfWeek = parseDayOfWeek(formData.get("dayOfWeek"));
  const startMinute = parseTimeToMinutes(formData.get("startTime"));
  const endMinute = parseTimeToMinutes(formData.get("endTime"));
  const color = normalizeHexColor(formData.get("color"));

  if (!doctorId) throw new Error("Seleziona un medico.");
  if (endMinute <= startMinute) throw new Error("L'orario di fine deve essere dopo l'inizio.");

  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor) throw new Error("Medico non trovato.");

  const windowRecord = (await availabilityClient.create({
    data: {
      doctorId,
      dayOfWeek,
      startMinute,
      endMinute,
      color,
    },
  })) as { id: string };

  await logAudit(admin, {
    action: "doctorAvailabilityWindow.created",
    entity: "DoctorAvailabilityWindow",
    entityId: windowRecord.id,
    metadata: { doctorId, dayOfWeek, startMinute, endMinute, color },
  });

  revalidatePath("/admin/calendario");
}

async function updateAvailabilityWindow(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
  if (!availabilityClient?.update) {
    throw new Error("Disponibilità non configurata. Esegui migrazioni Prisma e rigenera il client.");
  }

  const id = (formData.get("windowId") as string) || "";
  const doctorId = (formData.get("doctorId") as string) || "";
  const dayOfWeek = parseDayOfWeek(formData.get("dayOfWeek"));
  const startMinute = parseTimeToMinutes(formData.get("startTime"));
  const endMinute = parseTimeToMinutes(formData.get("endTime"));
  const color = normalizeHexColor(formData.get("color"));

  if (!id || !doctorId) throw new Error("Fascia non valida.");
  if (endMinute <= startMinute) throw new Error("L'orario di fine deve essere dopo l'inizio.");

  const windowRecord = (await availabilityClient.update({
    where: { id },
    data: { dayOfWeek, startMinute, endMinute, color },
  })) as { id: string };

  await logAudit(admin, {
    action: "doctorAvailabilityWindow.updated",
    entity: "DoctorAvailabilityWindow",
    entityId: windowRecord.id,
    metadata: { doctorId, dayOfWeek, startMinute, endMinute, color },
  });

  revalidatePath("/admin/calendario");
}

async function deleteAvailabilityWindow(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
  if (!availabilityClient?.delete) {
    throw new Error("Disponibilità non configurata. Esegui migrazioni Prisma e rigenera il client.");
  }

  const id = (formData.get("windowId") as string) || "";
  const doctorId = (formData.get("doctorId") as string) || "";
  if (!id) throw new Error("Fascia non valida.");

  await availabilityClient.delete({ where: { id } });

  await logAudit(admin, {
    action: "doctorAvailabilityWindow.deleted",
    entity: "DoctorAvailabilityWindow",
    entityId: id,
    metadata: { doctorId },
  });

  revalidatePath("/admin/calendario");
}

async function createPracticeClosure(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
  if (!closureClient?.create) {
    throw new Error("Chiusure non configurate. Esegui migrazioni Prisma e rigenera il client.");
  }

  const type = ((formData.get("type") as string) || "HOLIDAY") as PracticeClosureType;
  const title = (formData.get("title") as string)?.trim() || null;
  const startsAtRaw = (formData.get("startsAt") as string) || "";
  const endsAtRaw = (formData.get("endsAt") as string) || "";

  if (!PRACTICE_CLOSURE_TYPES.includes(type)) throw new Error("Tipo chiusura non valido.");
  if (!startsAtRaw || !endsAtRaw) throw new Error("Inserisci inizio e fine.");

  const startsAt = new Date(startsAtRaw);
  const endsAt = new Date(endsAtRaw);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new Error("Formato data/ora non valido.");
  }
  if (endsAt <= startsAt) throw new Error("La fine deve essere dopo l'inizio.");

  const closure = (await closureClient.create({
    data: { type, title, startsAt, endsAt },
  })) as { id: string };

  await logAudit(admin, {
    action: "practiceClosure.created",
    entity: "PracticeClosure",
    entityId: closure.id,
    metadata: { type, title, startsAt: startsAtRaw, endsAt: endsAtRaw },
  });

  revalidatePath("/admin/calendario");
}

async function updatePracticeClosure(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
  if (!closureClient?.update) {
    throw new Error("Chiusure non configurate. Esegui migrazioni Prisma e rigenera il client.");
  }

  const id = (formData.get("closureId") as string) || "";
  const type = ((formData.get("type") as string) || "HOLIDAY") as PracticeClosureType;
  const title = (formData.get("title") as string)?.trim() || null;
  const startsAtRaw = (formData.get("startsAt") as string) || "";
  const endsAtRaw = (formData.get("endsAt") as string) || "";

  if (!id) throw new Error("Chiusura non valida.");
  if (!PRACTICE_CLOSURE_TYPES.includes(type)) throw new Error("Tipo chiusura non valido.");
  if (!startsAtRaw || !endsAtRaw) throw new Error("Inserisci inizio e fine.");

  const startsAt = new Date(startsAtRaw);
  const endsAt = new Date(endsAtRaw);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new Error("Formato data/ora non valido.");
  }
  if (endsAt <= startsAt) throw new Error("La fine deve essere dopo l'inizio.");

  const closure = (await closureClient.update({
    where: { id },
    data: { type, title, startsAt, endsAt },
  })) as { id: string };

  await logAudit(admin, {
    action: "practiceClosure.updated",
    entity: "PracticeClosure",
    entityId: closure.id,
    metadata: { type, title, startsAt: startsAtRaw, endsAt: endsAtRaw },
  });

  revalidatePath("/admin/calendario");
}

async function deletePracticeClosure(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
  if (!closureClient?.delete) {
    throw new Error("Chiusure non configurate. Esegui migrazioni Prisma e rigenera il client.");
  }

  const id = (formData.get("closureId") as string) || "";
  if (!id) throw new Error("Chiusura non valida.");

  await closureClient.delete({ where: { id } });

  await logAudit(admin, {
    action: "practiceClosure.deleted",
    entity: "PracticeClosure",
    entityId: id,
  });

  revalidatePath("/admin/calendario");
}

async function saveWeeklyClosures(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
  if (!weeklyClosureClient?.create || !weeklyClosureClient?.update || !weeklyClosureClient?.delete) {
    throw new Error("Chiusure ricorrenti non configurate. Esegui migrazioni Prisma e rigenera il client.");
  }

  const existingRaw = weeklyClosureClient?.findMany
    ? ((await weeklyClosureClient.findMany({})) as PracticeWeeklyClosureRow[])
    : [];
  const existingByDay = new Map<number, PracticeWeeklyClosureRow>();
  existingRaw.forEach((row) => existingByDay.set(row.dayOfWeek, row));

  for (const day of WEEKDAYS) {
    const enabled = formData.get(`weeklyOff-${day.value}`) === "on";
    const title = (formData.get(`weeklyTitle-${day.value}`) as string | null)?.trim() || null;
    const existing = existingByDay.get(day.value);
    if (enabled) {
      if (existing) {
        await weeklyClosureClient.update({
          where: { id: existing.id },
          data: { isActive: true, title },
        });
      } else {
        await weeklyClosureClient.create({
          data: { dayOfWeek: day.value, title, isActive: true },
        });
      }
    } else if (existing) {
      await weeklyClosureClient.delete({ where: { id: existing.id } });
    }
  }

  await logAudit(admin, {
    action: "practiceWeeklyClosure.saved",
    entity: "PracticeWeeklyClosure",
  });

  revalidatePath("/admin/calendario");
}

export default async function AdminCalendarSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser([Role.ADMIN]);

  const doctors = await prisma.doctor.findMany({
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, specialty: true, color: true },
  });
  const params = searchParams ? await searchParams : {};
  const doctorParam = params.doctorId;
  const doctorParamValue =
    typeof doctorParam === "string"
      ? doctorParam
      : Array.isArray(doctorParam)
        ? doctorParam[0]
        : undefined;
  const selectedDoctorId =
    doctors.find((doctor) => doctor.id === doctorParamValue)?.id ?? doctors[0]?.id ?? "";

  const windows: AvailabilityWindowRow[] = availabilityClient?.findMany
    ? ((await availabilityClient.findMany({
        where: { doctorId: selectedDoctorId },
        orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
      })) as AvailabilityWindowRow[])
    : [];

  const closures: PracticeClosureRow[] = closureClient?.findMany
    ? ((await closureClient.findMany({
        orderBy: [{ startsAt: "desc" }],
      })) as PracticeClosureRow[])
    : [];

  const weeklyClosures: PracticeWeeklyClosureRow[] = weeklyClosureClient?.findMany
    ? ((await weeklyClosureClient.findMany({
        where: { isActive: true },
        orderBy: [{ dayOfWeek: "asc" }],
      })) as PracticeWeeklyClosureRow[])
    : [];

  const selectedDoctor = doctors.find((doctor) => doctor.id === selectedDoctorId) ?? null;
  const now = new Date();
  const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Aggiungi appuntamenti
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Disponibilità e chiusure</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Imposta le fasce di disponibilità per ogni medico e i periodi di chiusura/ferie dello studio.
        </p>
      </div>

      {!availabilityClient?.findMany || !closureClient?.findMany ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Questo modulo richiede la migrazione Prisma e la rigenerazione del client (`prisma migrate` + `prisma generate`).
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px,1fr]">
        <aside className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Medici</h2>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
              {doctors.length}
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {doctors.length === 0 ? (
              <p className="text-sm text-zinc-600">Nessun medico configurato.</p>
            ) : (
              doctors.map((doctor) => (
                <Link
                  key={doctor.id}
                  href={`/admin/calendario?doctorId=${encodeURIComponent(doctor.id)}`}
                  className={`block rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    doctor.id === selectedDoctorId
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-zinc-200 text-zinc-800 hover:border-emerald-200 hover:bg-emerald-50/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{doctor.fullName}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                      {doctor.specialty}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </aside>

        <main className="space-y-6">
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Disponibilità medico</h2>
                <p className="text-sm text-zinc-600">
                  {selectedDoctor ? `Gestisci le fasce orarie per ${selectedDoctor.fullName}.` : "Seleziona un medico."}
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                {windows.length} fasce
              </span>
            </div>

	            {selectedDoctor ? (
	              <div className="mt-4">
	                <AdminDoctorAvailabilityEditor
	                  doctorId={selectedDoctorId}
	                  doctorColor={selectedDoctor.color ?? null}
	                  windows={windows}
	                  createAction={createAvailabilityWindow}
	                  updateAction={updateAvailabilityWindow}
	                  deleteAction={deleteAvailabilityWindow}
	                />
	              </div>
	            ) : (
	              <p className="mt-4 text-sm text-zinc-600">Crea prima un medico per impostarne la disponibilità.</p>
	            )}
	          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Chiusure studio</h2>
                <p className="text-sm text-zinc-600">
                  Festività, ferie e periodi di indisponibilità della struttura.
                </p>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                {closures.length} periodi
              </span>
            </div>

            <details className="group mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 shadow-sm [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-4">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">Regole automatiche</h3>
                  <p className="mt-1 text-sm text-zinc-600">
                    Chiusure ricorrenti tutto il giorno (es. ogni Giovedì).
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-700 transition group-open:bg-emerald-50 group-open:text-emerald-800">
                  Gestisci
                </span>
              </summary>

              <form action={saveWeeklyClosures} className="space-y-3 px-4 pb-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {WEEKDAYS.map((day) => {
                    const active = weeklyClosures.some((c) => c.dayOfWeek === day.value);
                    const existing = weeklyClosures.find((c) => c.dayOfWeek === day.value) ?? null;
                    return (
                      <div
                        key={day.value}
                        className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <label className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900">
                            <input
                              type="checkbox"
                              name={`weeklyOff-${day.value}`}
                              defaultChecked={active}
                              className="h-4 w-4 rounded border-zinc-300"
                            />
                            {day.label}
                          </label>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              active ? "bg-zinc-200 text-zinc-700" : "bg-zinc-100 text-zinc-600"
                            }`}
                          >
                            {active ? "OFF" : "ON"}
                          </span>
                        </div>
                        <input
                          name={`weeklyTitle-${day.value}`}
                          defaultValue={existing?.title ?? ""}
                          placeholder="Titolo (opzionale) es. Chiuso"
                          className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        />
                      </div>
                    );
                  })}
                </div>
                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
                >
                  Salva regole
                </button>
              </form>
            </details>

            <form
              action={createPracticeClosure}
              className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[160px,1fr,1fr,1fr,auto]"
            >
	              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
	                Tipo
	                <select
	                  name="type"
	                  defaultValue="HOLIDAY"
	                  className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
	                >
	                  <option value="HOLIDAY">Festività</option>
	                  <option value="TIME_OFF">Chiusura/Ferie</option>
	                </select>
	              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                Titolo (opzionale)
                <input
                  name="title"
                  className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Es. Natale, ponte, ferie estive"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                Inizio
                  <input
                  name="startsAt"
                  type="datetime-local"
                  required
                  defaultValue={formatLocalInput(now)}
                  className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                Fine
                <input
                  name="endsAt"
                  type="datetime-local"
                  required
                  defaultValue={formatLocalInput(twoHoursLater)}
                  className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
                >
                  Aggiungi periodo
                </button>
              </div>
            </form>
            

            <div className="mt-6 space-y-3">
              {closures.length === 0 ? (
                <p className="text-sm text-zinc-600">Nessuna chiusura impostata.</p>
              ) : (
                closures.map((closure) => (
                  <div key={closure.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                      <form
                        action={updatePracticeClosure}
                        className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-[160px,1fr,1fr,1fr,auto]"
                      >
                        <input type="hidden" name="closureId" value={closure.id} />
                        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                          Tipo
	                          <select
	                            name="type"
	                            defaultValue={closure.type}
	                            className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
	                          >
	                            <option value="HOLIDAY">Festività</option>
	                            <option value="TIME_OFF">Chiusura/Ferie</option>
	                          </select>
	                        </label>
                        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                          Titolo
                          <input
                            name="title"
                            defaultValue={closure.title ?? ""}
                            className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                          Inizio
                          <input
                            name="startsAt"
                            type="datetime-local"
                            required
                            defaultValue={formatLocalInput(new Date(closure.startsAt))}
                            className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                          Fine
                          <input
                            name="endsAt"
                            type="datetime-local"
                            required
                            defaultValue={formatLocalInput(new Date(closure.endsAt))}
                            className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          />
                        </label>
                        <div className="flex items-end">
                          <button
                            type="submit"
                            className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-xs font-semibold text-white transition hover:bg-emerald-600"
                          >
                            Salva
                          </button>
                        </div>
                      </form>
                      <form
                        action={deletePracticeClosure}
                        className="flex justify-start lg:justify-end"
                        data-confirm="Eliminare definitivamente questa chiusura?"
                      >
                        <input type="hidden" name="closureId" value={closure.id} />
                        <button
                          type="submit"
                          className="inline-flex h-10 items-center justify-center rounded-full border border-rose-200 px-4 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-800"
                        >
                          Elimina
                        </button>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
