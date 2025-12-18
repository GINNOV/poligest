import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AppointmentStatus, Prisma, Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { AppointmentUpdateForm } from "@/components/appointment-update-form";
import { AgendaFilters } from "@/components/agenda-filters";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const PAGE_SIZE = 20;

const FALLBACK_SERVICES = ["Visita di controllo", "Igiene", "Otturazione", "Chirurgia"];

const formatLocalInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

function isNextRedirectError(err: unknown): err is { digest: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

async function hasDoctorConflict(params: {
  doctorId: string | null;
  startsAt: Date;
  endsAt: Date;
  excludeId?: string;
}) {
  const { doctorId, startsAt, endsAt, excludeId } = params;
  if (!doctorId) return false;

  const conflicts = await prisma.appointment.count({
    where: {
      doctorId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
  return conflicts > 0;
}

async function updateAppointmentStatus(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const appointmentId = formData.get("appointmentId") as string;
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

  revalidatePath("/agenda");
  redirect("/agenda");
}

async function updateAppointment(formData: FormData) {
  "use server";

  try {
    const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
    const appointmentId = formData.get("appointmentId") as string;
    const titleFromSelect = (formData.get("title") as string)?.trim();
    const titleCustom = (formData.get("titleCustom") as string)?.trim();
    const title = titleCustom || titleFromSelect || "Richiamo";
    const serviceTypeSelected = (formData.get("serviceType") as string)?.trim();
    const serviceTypeCustom = (formData.get("serviceTypeCustom") as string)?.trim();
    const serviceType = serviceTypeCustom || serviceTypeSelected || FALLBACK_SERVICES[0];
    const startsAt = formData.get("startsAt") as string;
    const endsAt = formData.get("endsAt") as string;
    const patientId = formData.get("patientId") as string;
    const doctorId = (formData.get("doctorId") as string) || null;
    const status = formData.get("status") as AppointmentStatus;

    if (!appointmentId || !title || !serviceType || !startsAt || !endsAt || !patientId) {
      throw new Error("Compila titolo, servizio, orari e paziente.");
    }

    const startsAtDate = new Date(startsAt);
    const endsAtDate = new Date(endsAt);
    if (Number.isNaN(startsAtDate.getTime()) || Number.isNaN(endsAtDate.getTime())) {
      throw new Error("Formato data/ora non valido.");
    }
    const adjustedEndsAt =
      endsAtDate <= startsAtDate
        ? new Date(startsAtDate.getTime() + 30 * 60 * 1000)
        : endsAtDate;

    if (!Object.keys(AppointmentStatus).includes(status)) {
      throw new Error("Stato non valido");
    }

    const current = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { status: true, startsAt: true, endsAt: true, doctorId: true },
    });
    if (!current) throw new Error("Appuntamento non trovato");
    if (current.status === AppointmentStatus.COMPLETED && user.role !== Role.ADMIN) {
      throw new Error("Solo l'admin può modificare appuntamenti completati");
    }

    const isSameSlot =
      current.doctorId === doctorId &&
      Math.abs(current.startsAt.getTime() - startsAtDate.getTime()) < 1000 &&
      Math.abs(current.endsAt.getTime() - adjustedEndsAt.getTime()) < 1000;

    if (!isSameSlot) {
      const hasConflict = await hasDoctorConflict({
        doctorId,
        startsAt: startsAtDate,
        endsAt: adjustedEndsAt,
        excludeId: appointmentId,
      });
      if (hasConflict) {
        throw new Error(
          "Il medico selezionato ha già un appuntamento in questo intervallo. Scegli un orario diverso."
        );
      }
    }

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        title,
        serviceType,
        startsAt: startsAtDate,
        endsAt: adjustedEndsAt,
        patientId,
        doctorId,
        status,
      },
    });

    await logAudit(user, {
      action: "appointment.updated",
      entity: "Appointment",
      entityId: appointmentId,
      metadata: { patientId, doctorId, status },
    });

    revalidatePath("/agenda");
    redirect("/agenda?success=Appuntamento aggiornato con successo.");
  } catch (err: unknown) {
    if (isNextRedirectError(err)) throw err;
    const message =
      typeof (err as { message?: unknown })?.message === "string"
        ? ((err as { message: string }).message ?? "")
        : "Errore durante l'aggiornamento dell'appuntamento.";
    console.error("Update appointment failed:", err);
    redirect(`/agenda?error=${encodeURIComponent(message)}`);
  }
}

async function deleteAppointment(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const appointmentId = (formData.get("appointmentId") as string) || "";

  if (!appointmentId) {
    throw new Error("Appuntamento mancante");
  }

  await prisma.appointment.delete({ where: { id: appointmentId } });

  await logAudit(user, {
    action: "appointment.deleted",
    entity: "Appointment",
    entityId: appointmentId,
  });

  revalidatePath("/agenda");
  redirect("/agenda");
}

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
  TO_CONFIRM: "border-amber-200 bg-amber-50 text-amber-800",
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  IN_WAITING: "border-zinc-200 bg-zinc-50 text-zinc-700",
  IN_PROGRESS: "border-sky-200 bg-sky-50 text-sky-800",
  COMPLETED: "border-green-200 bg-green-50 text-green-800",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-800",
  NO_SHOW: "border-slate-200 bg-slate-50 text-slate-700",
};

const statusCardBackgrounds: Record<AppointmentStatus, string> = {
  TO_CONFIRM: "border-amber-200 bg-gradient-to-r from-amber-50 via-white to-amber-50",
  CONFIRMED: "border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50",
  IN_WAITING: "border-zinc-200 bg-gradient-to-r from-zinc-50 via-white to-zinc-50",
  IN_PROGRESS: "border-sky-200 bg-gradient-to-r from-sky-50 via-white to-sky-50",
  COMPLETED: "border-green-200 bg-gradient-to-r from-green-50 via-white to-green-50",
  CANCELLED: "border-rose-200 bg-gradient-to-r from-rose-50 via-white to-rose-50",
  NO_SHOW: "border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50",
};

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const statusParam = params.status;
  const dateParam = params.date;
  const errorParam = params.error;
  const successParam = params.success;
  const errorMessage =
    typeof errorParam === "string" && errorParam !== "NEXT_REDIRECT" ? errorParam : null;
  const successMessage =
    typeof successParam === "string" && successParam !== "NEXT_REDIRECT" ? successParam : null;

  const statusValue =
    typeof statusParam === "string"
      ? statusParam
      : Array.isArray(statusParam)
        ? statusParam[0]
        : undefined;

  const dateValue =
    typeof dateParam === "string"
      ? dateParam
      : Array.isArray(dateParam)
        ? dateParam[0]
        : undefined;

  await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);

  const statusFilter =
    statusValue &&
    Object.values(AppointmentStatus).includes(statusValue as AppointmentStatus)
      ? (statusValue as AppointmentStatus)
      : undefined;

  const dateFilter = dateValue;
  const searchValue =
    typeof params.q === "string" ? params.q : Array.isArray(params.q) ? params.q[0] : "";
  const searchQuery = searchValue ? searchValue.toLowerCase() : undefined;
  let dateRange:
    | {
        gte: Date;
        lt: Date;
      }
    | undefined;

  if (dateFilter && !Number.isNaN(Date.parse(dateFilter))) {
    const start = new Date(dateFilter);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    dateRange = { gte: start, lt: end };
  }

  const pageParam =
    typeof params.page === "string"
      ? params.page
      : Array.isArray(params.page)
        ? params.page[0]
        : "1";
  const page = Math.max(1, Number.isNaN(Number(pageParam)) ? 1 : Number(pageParam));
  const skip = (page - 1) * PAGE_SIZE;

  const prismaModels = prisma as unknown as Record<string, unknown>;
  const serviceClient = prismaModels["service"] as
    | { findMany?: (args: unknown) => Promise<unknown[]> }
    | undefined;

  const where: Prisma.AppointmentWhereInput = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(dateRange ? { startsAt: dateRange } : {}),
    ...(searchQuery
      ? {
          OR: [
            { title: { contains: searchQuery, mode: Prisma.QueryMode.insensitive } },
            { serviceType: { contains: searchQuery, mode: Prisma.QueryMode.insensitive } },
            {
              patient: {
                OR: [
                  { firstName: { contains: searchQuery, mode: Prisma.QueryMode.insensitive } },
                  { lastName: { contains: searchQuery, mode: Prisma.QueryMode.insensitive } },
                ],
              },
            },
            {
              doctor: {
                OR: [
                  { fullName: { contains: searchQuery, mode: Prisma.QueryMode.insensitive } },
                  { specialty: { contains: searchQuery, mode: Prisma.QueryMode.insensitive } },
                ],
              },
            },
          ],
        }
      : {}),
  };

  const [appointments, patients, doctors, servicesRaw, totalCount] = await Promise.all([
    prisma.appointment.findMany({
      orderBy: { startsAt: "asc" },
      take: PAGE_SIZE,
      skip,
      include: {
        patient: { select: { firstName: true, lastName: true } },
        doctor: { select: { fullName: true, specialty: true } },
      },
      where,
    }),
    prisma.patient.findMany({ orderBy: { lastName: "asc" } }),
    prisma.doctor.findMany({ orderBy: { fullName: "asc" } }),
    serviceClient?.findMany ? serviceClient.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    prisma.appointment.count({ where }),
  ]);

  type ServiceRow = { name: string };
  const services = servicesRaw as ServiceRow[];

  const serviceOptions = Array.from(
    new Set([
      ...services.map((s) => s.name),
      ...FALLBACK_SERVICES,
    ]).values()
  );
  const serviceOptionObjects = serviceOptions.map((name) => ({ id: name, name }));

  const availabilityClient = prismaModels["doctorAvailabilityWindow"] as
    | { findMany?: (args: unknown) => Promise<unknown[]> }
    | undefined;
  const closureClient = prismaModels["practiceClosure"] as
    | { findMany?: (args: unknown) => Promise<unknown[]> }
    | undefined;
  const weeklyClosureClient = prismaModels["practiceWeeklyClosure"] as
    | { findMany?: (args: unknown) => Promise<unknown[]> }
    | undefined;

  const [availabilityWindowsRaw, practiceClosuresRaw, practiceWeeklyClosuresRaw] = await Promise.all([
    availabilityClient?.findMany ? availabilityClient.findMany({}) : Promise.resolve([]),
    closureClient?.findMany
      ? closureClient.findMany({ orderBy: [{ startsAt: "desc" }] })
      : Promise.resolve([]),
    weeklyClosureClient?.findMany
      ? weeklyClosureClient.findMany({ where: { isActive: true }, orderBy: [{ dayOfWeek: "asc" }] })
      : Promise.resolve([]),
  ]);

  const availabilityWindows = (availabilityWindowsRaw as unknown[]).map((row) => {
    const win = row as Record<string, unknown>;
    return {
      doctorId: String(win.doctorId ?? ""),
      dayOfWeek: Number(win.dayOfWeek ?? 0),
      startMinute: Number(win.startMinute ?? 0),
      endMinute: Number(win.endMinute ?? 0),
    };
  });

  const practiceClosures = (practiceClosuresRaw as unknown[]).map((row) => {
    const closure = row as Record<string, unknown>;
    return {
      startsAt: new Date(String(closure.startsAt ?? "")).toISOString(),
      endsAt: new Date(String(closure.endsAt ?? "")).toISOString(),
      title: (closure.title as string | null) ?? null,
      type: (closure.type as string | undefined) ?? undefined,
    };
  });

  const practiceWeeklyClosures = (practiceWeeklyClosuresRaw as unknown[]).map((row) => {
    const closure = row as Record<string, unknown>;
    return {
      dayOfWeek: Number(closure.dayOfWeek ?? 0),
      title: (closure.title as string | null) ?? null,
    };
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const showingFrom = totalCount === 0 ? 0 : skip + 1;
  const showingTo = skip + appointments.length;
  const buildPageHref = (targetPage: number) => {
    const query = new URLSearchParams();
    if (statusValue) query.set("status", statusValue);
    if (dateValue) query.set("date", dateValue);
    if (searchValue) query.set("q", searchValue);
    query.set("page", String(targetPage));
    return `/agenda?${query.toString()}`;
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Appuntamenti</h2>
        {successMessage ? (
          <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
        <AgendaFilters
          statusLabels={statusLabels}
          statusValue={statusValue}
          dateValue={dateValue}
          searchValue={searchValue}
        />
        <div className="mt-4 divide-y divide-zinc-100">
          {appointments.length === 0 ? (
            <p className="py-4 text-sm text-zinc-600">Nessun appuntamento.</p>
          ) : (
            appointments.map((appt) => (
              <div
                key={appt.id}
                className={`mb-3 rounded-2xl border p-4 shadow-sm ${statusCardBackgrounds[appt.status]}`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
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
                      <span className="font-semibold">{appt.title}</span> - 🧑‍⚕️ Paziente{" "}
                      <Link
                        href={`/pazienti/${appt.patientId}`}
                        className="font-semibold hover:text-emerald-700"
                      >
                        {appt.patient.lastName} {appt.patient.firstName}
                      </Link>{" "}
                      sarà visitato da <span className="font-semibold">{appt.doctor?.fullName ?? "—"}</span>{" "}
                      {appt.doctor?.specialty ? `(${appt.doctor.specialty})` : ""} il{" "}
                      {new Intl.DateTimeFormat("it-IT", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      }).format(appt.startsAt)}{" "}
                      alle {new Intl.DateTimeFormat("it-IT", { timeStyle: "short" }).format(appt.startsAt)}.
                    </p>
                    <p className="text-sm text-zinc-800">
                      🕒 Il servizio richiederà circa{" "}
                      {Math.max(
                        1,
                        Math.round(
                          (appt.endsAt.getTime() - appt.startsAt.getTime()) / (1000 * 60 * 60)
                        )
                      )}{" "}
                      ora/e.
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase ${statusClasses[appt.status]}`}
                    >
                      {statusLabels[appt.status].toUpperCase()}
                    </span>
                    <form
                      action={updateAppointmentStatus}
                      className="flex items-center gap-2 text-xs"
                    >
                      <input type="hidden" name="appointmentId" value={appt.id} />
                      <select
                        name="status"
                        defaultValue={appt.status}
                        className="h-9 rounded-full border border-zinc-200 bg-white px-3 pr-2 text-[11px] font-semibold uppercase text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      >
                        {Object.values(AppointmentStatus).map((status) => (
                          <option key={status} value={status}>
                            {statusLabels[status].toUpperCase()}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-full bg-emerald-700 px-3 py-1 font-semibold text-white transition hover:bg-emerald-600"
                      >
                        Aggiorna
                      </button>
                    </form>
                  </div>
                </div>

                <details className="mt-3 rounded-xl border border-zinc-200 bg-white/70 p-3 text-xs text-zinc-700">
                  <summary className="cursor-pointer font-semibold text-emerald-800">
                    Modifica appuntamento
                  </summary>
	                  <AppointmentUpdateForm
	                    appointment={{
	                      id: appt.id,
	                      title: appt.title,
	                      serviceType: appt.serviceType,
	                      startsAt: formatLocalInput(appt.startsAt),
	                      endsAt: formatLocalInput(appt.endsAt),
	                      patientId: appt.patientId,
	                      doctorId: appt.doctorId,
	                      status: appt.status,
	                    }}
	                    patients={patients}
	                    doctors={doctors}
	                    services={serviceOptionObjects}
	                    availabilityWindows={availabilityWindows}
	                    practiceClosures={practiceClosures}
	                    practiceWeeklyClosures={practiceWeeklyClosures}
	                    action={updateAppointment}
	                  />
                  <form
                    action={deleteAppointment}
                    className="mt-3 flex justify-end"
                    data-confirm="Eliminare definitivamente questo appuntamento?"
                  >
                    <input type="hidden" name="appointmentId" value={appt.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50"
                    >
                      Elimina appuntamento
                    </button>
                  </form>
                </details>
              </div>
            ))
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          <p>
            Mostrati{" "}
            {totalCount === 0 ? "0" : `${showingFrom}-${Math.min(showingTo, totalCount)}`} di{" "}
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
