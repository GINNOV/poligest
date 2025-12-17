import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { it } from "date-fns/locale";
import { CalendarDoctorFilter } from "@/components/calendar-doctor-filter";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const params = await searchParams;

  const monthParam =
    typeof params.month === "string"
      ? params.month
      : Array.isArray(params.month)
        ? params.month[0]
        : undefined;
  const monthMatch = monthParam?.match(/^(\d{4})-(\d{2})$/);
  const baseMonth = monthMatch
    ? new Date(Number(monthMatch[1]), Number(monthMatch[2]) - 1, 1)
    : new Date();

  const doctors = await prisma.doctor.findMany({
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, specialty: true },
  });

  const doctorParam =
    typeof params.doctor === "string"
      ? params.doctor
      : Array.isArray(params.doctor)
        ? params.doctor[0]
        : undefined;

  const selectedDoctorId =
    doctors.find((doc) => doc.id === doctorParam)?.id ?? doctors[0]?.id;
  const selectedDoctor = doctors.find((doc) => doc.id === selectedDoctorId);

  const monthStart = startOfMonth(baseMonth);
  const monthEnd = endOfMonth(baseMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const appointments = selectedDoctorId
    ? await prisma.appointment.findMany({
        where: {
          doctorId: selectedDoctorId,
          startsAt: { gte: monthStart, lte: monthEnd },
        },
        orderBy: { startsAt: "asc" },
        include: {
          patient: { select: { firstName: true, lastName: true } },
        },
      })
    : [];

  const appointmentsByDay = new Map<string, typeof appointments>();
  appointments.forEach((appt) => {
    const key = format(appt.startsAt, "yyyy-MM-dd");
    if (!appointmentsByDay.has(key)) {
      appointmentsByDay.set(key, []);
    }
    appointmentsByDay.get(key)?.push(appt);
  });

  const monthLabel = new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
  }).format(baseMonth);
  const prevMonth = format(addMonths(baseMonth, -1), "yyyy-MM");
  const nextMonth = format(addMonths(baseMonth, 1), "yyyy-MM");
  const currentMonthKey = format(new Date(), "yyyy-MM");
  const doctorOptionList = doctors.map((doc) => ({
    id: doc.id,
    label: `${doc.fullName}${doc.specialty ? ` (${doc.specialty})` : ""}`,
  }));

  const buildMonthLink = (monthValue: string) => {
    const nextParams = new URLSearchParams();
    nextParams.set("month", monthValue);
    if (selectedDoctorId) nextParams.set("doctor", selectedDoctorId);
    return `/calendar?${nextParams.toString()}`;
  };

  return (
    <div className="space-y-6">
      <nav className="text-sm text-zinc-600">
        <Link href="/dashboard" className="hover:text-emerald-700">
          Cruscotto
        </Link>{" "}
        / <span className="text-zinc-900">Calendario</span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Calendario
          </p>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Calendario mensile
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Seleziona un medico per vedere la pianificazione del mese.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
          <CalendarDoctorFilter
            doctors={doctorOptionList}
            selectedDoctorId={selectedDoctorId}
          />
          <span className="rounded-full bg-emerald-50 px-4 py-1 text-xs font-semibold text-emerald-800">
            {selectedDoctor ? selectedDoctor.fullName : "Nessun medico"}
          </span>
        </div>
      </div>

      {doctors.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
          Nessun medico registrato. Aggiungi un medico per usare il calendario.
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 capitalize">
                {monthLabel}
              </h2>
              <p className="text-xs text-zinc-500">
                {selectedDoctor?.fullName ?? "Medico"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-600">
              <Link
                href={buildMonthLink(prevMonth)}
                className="rounded-full border border-zinc-200 px-3 py-1 transition hover:border-emerald-200 hover:text-emerald-700"
              >
                ← Mese precedente
              </Link>
              <Link
                href={buildMonthLink(currentMonthKey)}
                className="rounded-full border border-zinc-200 px-3 py-1 transition hover:border-emerald-200 hover:text-emerald-700"
              >
                Mese corrente
              </Link>
              <Link
                href={buildMonthLink(nextMonth)}
                className="rounded-full border border-zinc-200 px-3 py-1 transition hover:border-emerald-200 hover:text-emerald-700"
              >
                Mese successivo →
              </Link>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                {appointments.length} appuntamenti
              </span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-[11px] font-semibold uppercase text-zinc-500">
            {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((label) => (
              <div key={label} className="px-2">
                {label}
              </div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayAppointments = appointmentsByDay.get(key) ?? [];
              const inMonth = isSameMonth(day, monthStart);
              const dayLabel = format(day, "d", { locale: it });
              return (
                <div
                  key={key}
                  className={`flex min-h-[140px] flex-col rounded-xl border p-2 ${
                    inMonth ? "border-zinc-200 bg-white" : "border-zinc-100 bg-zinc-50 text-zinc-400"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span
                      className={`h-6 w-6 rounded-full text-center leading-6 ${
                        isToday(day) && inMonth ? "bg-emerald-100 text-emerald-800" : ""
                      }`}
                    >
                      {dayLabel}
                    </span>
                    {dayAppointments.length ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-800">
                        {dayAppointments.length}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex-1 space-y-1 overflow-y-auto">
                    {dayAppointments.length === 0 ? (
                      <p className="text-[10px] text-zinc-400">Nessun appuntamento</p>
                    ) : (
                      dayAppointments.map((appt) => {
                        const timeLabel = new Intl.DateTimeFormat("it-IT", {
                          timeStyle: "short",
                        }).format(appt.startsAt);
                        return (
                          <div
                            key={appt.id}
                            className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] text-zinc-700"
                          >
                            <div className="font-semibold text-zinc-800">
                              {timeLabel} · {appt.serviceType}
                            </div>
                            <div className="truncate">
                              {appt.patient.lastName} {appt.patient.firstName}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
