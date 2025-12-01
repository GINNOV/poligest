import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { AppointmentStatus, Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

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

export default async function AgendaPage() {
  await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const t = await getTranslations("agenda");

  const [appointments, patients, doctors] = await Promise.all([
    prisma.appointment.findMany({
      orderBy: { startsAt: "asc" },
      take: 20,
      include: {
        patient: { select: { firstName: true, lastName: true } },
        doctor: { select: { fullName: true, specialty: true } },
      },
    }),
    prisma.patient.findMany({ orderBy: { lastName: "asc" } }),
    prisma.doctor.findMany({ orderBy: { fullName: "asc" } }),
  ]);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">{t("title")}</h1>
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
        <h2 className="text-lg font-semibold text-zinc-900">Agenda</h2>
        <div className="mt-4 divide-y divide-zinc-100">
          {appointments.length === 0 ? (
            <p className="py-4 text-sm text-zinc-600">Nessun appuntamento.</p>
          ) : (
            appointments.map((appt) => (
              <div key={appt.id} className="flex flex-col gap-1 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-900">{appt.title}</span>
                  <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                    {statusLabels[appt.status]}
                  </span>
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
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
