import { prisma } from "@/lib/prisma";
import { AppointmentStatus, Role } from "@prisma/client";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";

const statusLabels: Record<AppointmentStatus, string> = {
  TO_CONFIRM: "Da confermare",
  CONFIRMED: "Confermato",
  IN_WAITING: "In attesa",
  IN_PROGRESS: "In corso",
  COMPLETED: "Completato",
  CANCELLED: "Annullato",
  NO_SHOW: "No-show",
};

export default async function DashboardPage() {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const t = await getTranslations("dashboard");

  const since = new Date();
  since.setDate(since.getDate() - 1);

  const [appointments, patientsCount, doctorsCount] = await Promise.all([
    prisma.appointment.findMany({
      orderBy: { startsAt: "asc" },
      take: 5,
      include: {
        patient: { select: { firstName: true, lastName: true } },
        doctor: { select: { fullName: true, specialty: true } },
      },
      where: { startsAt: { gte: since } },
    }),
    prisma.patient.count(),
    prisma.doctor.count(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-600">{t("welcome")}</p>
          <h1 className="text-3xl font-semibold text-zinc-900">
            {user.name ?? user.email}
          </h1>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t("stats.patients")} value={patientsCount} />
        <StatCard label={t("stats.doctors")} value={doctorsCount} />
        <StatCard label={t("stats.upcoming")} value={appointments.length} />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">
          {t("upcoming")}
        </h2>
        <div className="divide-y divide-zinc-100">
          {appointments.length === 0 ? (
            <p className="py-4 text-sm text-zinc-600">{t("empty")}</p>
          ) : (
            appointments.map((appt) => (
              <div key={appt.id} className="flex items-center justify-between py-3">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-zinc-900">
                    {appt.title} · {appt.patient.firstName} {appt.patient.lastName}
                  </p>
                  <p className="text-xs text-zinc-600">
                    {appt.doctor?.fullName ?? "—"} · {appt.doctor?.specialty ?? ""}
                  </p>
                  <p className="text-xs text-zinc-600">
                    {format(appt.startsAt, "EEEE d MMMM yyyy 'alle' HH:mm", {
                      locale: it,
                    })}
                  </p>
                </div>
                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                  {statusLabels[appt.status]}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-zinc-600">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
