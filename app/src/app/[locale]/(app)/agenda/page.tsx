import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { AppointmentStatus, Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function createAppointment(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);

  const title = (formData.get("title") as string)?.trim();
  const serviceType = (formData.get("serviceType") as string)?.trim();
  const startsAt = formData.get("startsAt") as string;
  const endsAt = formData.get("endsAt") as string;
  const patientId = formData.get("patientId") as string;
  const doctorId = (formData.get("doctorId") as string) || null;

  if (!title || !serviceType || !startsAt || !endsAt || !patientId) {
    throw new Error("Campi obbligatori mancanti");
  }

  const appointment = await prisma.appointment.create({
    data: {
      title,
      serviceType,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      patientId,
      doctorId,
      status: AppointmentStatus.TO_CONFIRM,
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
}

async function updateAppointmentStatus(formData: FormData) {
  "use server";

  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const appointmentId = formData.get("appointmentId") as string;
  const status = formData.get("status") as AppointmentStatus;

  if (!appointmentId || !status || !Object.keys(AppointmentStatus).includes(status)) {
    throw new Error("Dati aggiornamento non validi");
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

  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const appointmentId = formData.get("appointmentId") as string;
  const title = (formData.get("title") as string)?.trim();
  const serviceType = (formData.get("serviceType") as string)?.trim();
  const startsAt = formData.get("startsAt") as string;
  const endsAt = formData.get("endsAt") as string;
  const patientId = formData.get("patientId") as string;
  const doctorId = (formData.get("doctorId") as string) || null;
  const status = formData.get("status") as AppointmentStatus;

  if (!appointmentId || !title || !serviceType || !startsAt || !endsAt || !patientId) {
    throw new Error("Campi obbligatori mancanti");
  }

  if (!Object.keys(AppointmentStatus).includes(status)) {
    throw new Error("Stato non valido");
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      title,
      serviceType,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
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

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const statusParam = params.status;
  const dateParam = params.date;

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

  const [appointments, patients, doctors] = await Promise.all([
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
      },
    }),
    prisma.patient.findMany({ orderBy: { lastName: "asc" } }),
    prisma.doctor.findMany({ orderBy: { fullName: "asc" } }),
  ]);

  const filteredAppointments = appointments;

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Aggiungi appuntamento</h1>
        <p className="mt-2 text-sm text-zinc-600">{t("subtitle")}</p>

        <form action={createAppointment} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            Titolo
            <input
              className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              name="title"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            Servizio
            <input
              className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              name="serviceType"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            Inizio
            <input
              className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              type="datetime-local"
              name="startsAt"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            Fine
            <input
              className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              type="datetime-local"
              name="endsAt"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            Paziente
            <select
              name="patientId"
              className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Seleziona paziente
              </option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.lastName} {p.firstName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            Medico (opzionale)
            <select
              name="doctorId"
              className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              defaultValue=""
            >
              <option value="">—</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName} {d.specialty ? `· ${d.specialty}` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="col-span-full">
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
            >
              Aggiungi appuntamento
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Appuntamenti</h2>
        <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" method="get">
          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            {t("filterDate")}
            <input
              type="date"
              name="date"
              defaultValue={dateValue ?? ""}
              className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            {t("filterStatus")}
            <select
              name="status"
              defaultValue={statusValue ?? ""}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">{t("filterStatus")}</option>
              {Object.values(AppointmentStatus).map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <div className="col-span-full flex gap-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
            >
              Applica filtri
            </button>
            <a
              href="/agenda"
              className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700"
            >
              Mostra tutto
            </a>
          </div>
        </form>
        <div className="mt-4 divide-y divide-zinc-100">
          {filteredAppointments.length === 0 ? (
            <p className="py-4 text-sm text-zinc-600">Nessun appuntamento.</p>
          ) : (
            filteredAppointments.map((appt) => (
              <div key={appt.id} className="flex flex-col gap-1 py-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                    <span aria-hidden="true" className="text-base">
                      {(appt.serviceType ?? "")
                        .toLowerCase()
                        .includes("odo") ||
                      (appt.doctor?.specialty ?? "")
                        .toLowerCase()
                        .includes("odo")
                        ? "🦷"
                        : "❤️"}
                    </span>
                    {appt.title}
                  </span>
                  <form action={updateAppointmentStatus} className="flex items-center gap-2 text-xs">
                    <input type="hidden" name="appointmentId" value={appt.id} />
                    <select
                      name="status"
                      defaultValue={appt.status}
                      className="h-9 rounded-full border border-zinc-200 bg-white px-3 pr-2 text-[11px] font-semibold text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    >
                      {Object.values(AppointmentStatus).map((status) => (
                        <option key={status} value={status}>
                          {statusLabels[status]}
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
                <span className="text-xs text-zinc-600">
                  {appt.patient.lastName} {appt.patient.firstName} ·{" "}
                  {appt.doctor ? `${appt.doctor.fullName} (${appt.doctor.specialty ?? "—"})` : "—"}
                </span>
                <span className="text-xs text-zinc-600">
                  {new Intl.DateTimeFormat("it-IT", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(appt.startsAt)}{" "}
                  -{" "}
                  {new Intl.DateTimeFormat("it-IT", {
                    timeStyle: "short",
                  }).format(appt.endsAt)}
                </span>
                <details className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 text-xs text-zinc-700">
                  <summary className="cursor-pointer font-semibold text-emerald-800">
                    Modifica appuntamento
                  </summary>
                  <form action={updateAppointment} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input type="hidden" name="appointmentId" value={appt.id} />
                    <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-700">
                      Titolo
                      <input
                        name="title"
                        defaultValue={appt.title}
                        className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        required
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-700">
                      Servizio
                      <input
                        name="serviceType"
                        defaultValue={appt.serviceType}
                        className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        required
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-700">
                      Inizio
                      <input
                        type="datetime-local"
                        name="startsAt"
                        defaultValue={appt.startsAt.toISOString().slice(0, 16)}
                        className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        required
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-700">
                      Fine
                      <input
                        type="datetime-local"
                        name="endsAt"
                        defaultValue={appt.endsAt.toISOString().slice(0, 16)}
                        className="h-9 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        required
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-700">
                      Paziente
                      <select
                        name="patientId"
                        defaultValue={appt.patientId}
                        className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        required
                      >
                        {patients.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.lastName} {p.firstName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-700">
                      Medico
                      <select
                        name="doctorId"
                        defaultValue={appt.doctorId ?? ""}
                        className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      >
                        <option value="">—</option>
                        {doctors.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.fullName} {d.specialty ? `· ${d.specialty}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-700">
                      Stato
                      <select
                        name="status"
                        defaultValue={appt.status}
                        className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      >
                        {Object.values(AppointmentStatus).map((status) => (
                          <option key={status} value={status}>
                            {statusLabels[status]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="col-span-full">
                      <button
                        type="submit"
                        className="inline-flex h-9 items-center justify-center rounded-full bg-zinc-900 px-4 text-xs font-semibold text-white transition hover:bg-zinc-800"
                      >
                        Salva modifiche
                      </button>
                    </div>
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
