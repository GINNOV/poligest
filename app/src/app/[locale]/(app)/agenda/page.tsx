import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { AppointmentStatus, Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { FormSubmitButton } from "@/components/form-submit-button";
import { AppointmentCreateForm } from "@/components/appointment-create-form";
import { AppointmentsCalendar } from "@/components/appointments-calendar";
import { AppointmentUpdateForm } from "@/components/appointment-update-form";
import { AgendaFilters } from "@/components/agenda-filters";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FALLBACK_SERVICES = ["Visita di controllo", "Igiene", "Otturazione", "Chirurgia"];

const formatLocalInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

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

async function createAppointment(formData: FormData) {
  "use server";

  try {
    const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);

    const titleFromSelect = (formData.get("title") as string)?.trim();
    const titleCustom = (formData.get("titleCustom") as string)?.trim();
    const title = titleCustom || titleFromSelect || "Richiamo";
    const serviceTypeSelected = (formData.get("serviceType") as string)?.trim();
    const serviceTypeCustom = (formData.get("serviceTypeCustom") as string)?.trim();
    const serviceType = serviceTypeCustom || serviceTypeSelected || FALLBACK_SERVICES[0];
    const startsAt = formData.get("startsAt") as string;
    // Force end to +1h from start regardless of submitted value.
    const endsAtRaw = formData.get("endsAt") as string;
    const endsAtDate =
      endsAtRaw && !endsAtRaw.endsWith(":") ? new Date(endsAtRaw) : startsAt ? new Date(new Date(startsAt).getTime() + 60 * 60 * 1000) : null;
    const patientIdRaw = formData.get("patientId") as string;
    const doctorId = (formData.get("doctorId") as string) || null;
    const notes = (formData.get("notes") as string)?.trim() || null;

    if (!title || !serviceType || !startsAt || !endsAtDate || !patientIdRaw) {
      throw new Error("Compila titolo, servizio, orari e paziente.");
    }

    const startsAtDate = new Date(startsAt);
    if (Number.isNaN(startsAtDate.getTime()) || Number.isNaN(endsAtDate.getTime())) {
      throw new Error("Formato data/ora non valido.");
    }
    const adjustedEndsAt =
      endsAtDate <= startsAtDate
        ? new Date(startsAtDate.getTime() + 60 * 60 * 1000)
        : endsAtDate;

    const hasConflict = await hasDoctorConflict({
      doctorId,
      startsAt: startsAtDate,
      endsAt: adjustedEndsAt,
    });
    if (hasConflict) {
      throw new Error(
        "Il medico selezionato ha già un appuntamento in questo intervallo. Scegli un orario diverso."
      );
    }

    let patientId = patientIdRaw;
    if (patientIdRaw === "new") {
      const newFirstName = (formData.get("newFirstName") as string)?.trim();
      const newLastName = (formData.get("newLastName") as string)?.trim();
      const newPhone = (formData.get("newPhone") as string)?.trim();
      if (!newFirstName || !newLastName || !newPhone) {
        throw new Error("Inserisci nome, cognome e telefono per il nuovo cliente.");
      }
      const patient = await prisma.patient.create({
        data: {
          firstName: newFirstName,
          lastName: newLastName,
          phone: newPhone,
        },
      });
      patientId = patient.id;
    }

    const appointment = await prisma.appointment.create({
      data: {
        title,
        serviceType,
        startsAt: startsAtDate,
        endsAt: adjustedEndsAt,
        patientId,
        doctorId,
        notes,
        status: AppointmentStatus.CONFIRMED,
      },
    });

    await logAudit(user, {
      action: "appointment.created",
      entity: "Appointment",
      entityId: appointment.id,
      metadata: { patientId, doctorId },
    });

    revalidatePath("/agenda");
    redirect("/agenda");
  } catch (err: any) {
    // Let framework redirects bubble through (digest contains NEXT_REDIRECT;push;...).
    if (typeof err?.digest === "string" && err.digest.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    const message = err?.message ?? "Errore durante la creazione dell'appuntamento.";
    console.error("Create appointment failed:", err);
    redirect(`/agenda?error=${encodeURIComponent(message)}`);
  }
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

    const currentStartsInput = formatLocalInput(current.startsAt);
    const currentEndsInput = formatLocalInput(current.endsAt);

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
  } catch (err: any) {
    if (typeof err?.digest === "string" && err.digest.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    const message = err?.message ?? "Errore durante l'aggiornamento dell'appuntamento.";
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
  const t = await getTranslations("agenda");

  const statusFilter =
    statusValue &&
    Object.values(AppointmentStatus).includes(statusValue as AppointmentStatus)
      ? (statusValue as AppointmentStatus)
      : undefined;

  const dateFilter = dateValue;
  const searchQuery =
    typeof params.q === "string"
      ? params.q.toLowerCase()
      : Array.isArray(params.q)
        ? params.q[0]?.toLowerCase()
        : undefined;
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

  const [appointments, patients, doctors, services] = await Promise.all([
    prisma.appointment.findMany({
      orderBy: { startsAt: "asc" },
      take: 100,
      include: {
        patient: { select: { firstName: true, lastName: true } },
        doctor: { select: { fullName: true, specialty: true } },
      },
      where: {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(dateRange ? { startsAt: dateRange } : {}),
        ...(searchQuery
          ? {
              OR: [
                { title: { contains: searchQuery, mode: "insensitive" } },
                { serviceType: { contains: searchQuery, mode: "insensitive" } },
                {
                  patient: {
                    OR: [
                      { firstName: { contains: searchQuery, mode: "insensitive" } },
                      { lastName: { contains: searchQuery, mode: "insensitive" } },
                    ],
                  },
                },
                {
                  doctor: {
                    OR: [
                      { fullName: { contains: searchQuery, mode: "insensitive" } },
                      { specialty: { contains: searchQuery, mode: "insensitive" } },
                    ],
                  },
                },
              ],
            }
          : {}),
      },
    }),
    prisma.patient.findMany({ orderBy: { lastName: "asc" } }),
    prisma.doctor.findMany({ orderBy: { fullName: "asc" } }),
    (prisma as any).service?.findMany
      ? (prisma as any).service.findMany({ orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  const filteredAppointments = appointments;
  const serviceOptions = Array.from(
    new Set([
      ...services.map((s: any) => s.name as string),
      ...FALLBACK_SERVICES,
    ]).values()
  );
  const serviceOptionObjects = serviceOptions.map((name) => ({ id: name, name }));
  const calendarEvents = filteredAppointments.map((appt) => ({
    id: appt.id,
    title: appt.title,
    serviceType: appt.serviceType,
    startsAt: appt.startsAt.toISOString(),
    endsAt: appt.endsAt.toISOString(),
    patientName: `${appt.patient.lastName} ${appt.patient.firstName}`,
  }));

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">📅 Aggiungi appuntamento</h1>
        <p className="mt-2 text-sm text-zinc-600">Schedula un appuntamento per nuovi clienti o pazienti esistenti.</p>

        <AppointmentCreateForm
          patients={patients}
          doctors={doctors}
          serviceOptions={serviceOptions}
          action={createAppointment}
        />
      </div>

      <AppointmentsCalendar events={calendarEvents} />

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
          searchValue={
            typeof params.q === "string" ? params.q : Array.isArray(params.q) ? params.q[0] : ""
          }
        />
        <div className="mt-4 divide-y divide-zinc-100">
          {filteredAppointments.length === 0 ? (
            <p className="py-4 text-sm text-zinc-600">Nessun appuntamento.</p>
          ) : (
            filteredAppointments.map((appt) => (
              <div
                key={appt.id}
                className="mb-3 rounded-2xl border border-zinc-200 bg-gradient-to-r from-white via-zinc-50 to-white p-4 shadow-sm"
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
      </div>
    </div>
  );
}
