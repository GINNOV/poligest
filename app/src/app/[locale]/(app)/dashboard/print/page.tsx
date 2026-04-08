import Image from "next/image";
import type { Metadata } from "next";
import { AutoPrintOnLoad } from "@/components/auto-print-on-load";
import { PrintButton } from "@/components/print-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lista appuntamenti del giorno",
};

const LOCALE = "it-IT";
const TIME_ZONE = "Europe/Rome";
const DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const getDateKey = (date: Date) => DATE_KEY_FORMATTER.format(date);

type DashboardPrintPageProps = {
  searchParams?: Promise<{ day?: string; doctor?: string }>;
};

export default async function DashboardPrintPage({ searchParams }: DashboardPrintPageProps) {
  await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);

  const resolvedParams = searchParams ? await searchParams : undefined;
  const selectedDay = typeof resolvedParams?.day === "string" ? resolvedParams.day : "";
  const selectedDoctor = typeof resolvedParams?.doctor === "string" ? resolvedParams.doctor : "";
  const parsedDay = selectedDay ? new Date(`${selectedDay}T00:00:00Z`) : null;
  const safeParsedDay =
    parsedDay && !Number.isNaN(parsedDay.getTime()) ? parsedDay : new Date();
  const rangeStart = new Date(safeParsedDay);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 1);
  const rangeEnd = new Date(safeParsedDay);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 2);
  const dayKey = selectedDay || getDateKey(safeParsedDay);

  const appointments = await prisma.appointment.findMany({
    where: {
      startsAt: {
        gte: rangeStart,
        lt: rangeEnd,
      },
      ...(selectedDoctor && selectedDoctor !== "all"
        ? { doctor: { fullName: selectedDoctor } }
        : {}),
    },
    orderBy: { startsAt: "asc" },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      doctor: { select: { fullName: true } },
    },
  });

  const dayAppointments = appointments.filter((appointment) => getDateKey(appointment.startsAt) === dayKey);
  const printableDate = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(safeParsedDay);

  return (
    <div className="min-h-screen bg-zinc-100 px-6 py-8 print:bg-white print:px-0 print:py-0">
      <AutoPrintOnLoad />
      <div className="mx-auto max-w-5xl space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm print:max-w-none print:border-none print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-6 print:pb-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-40 rounded-lg bg-white p-2">
              <Image
                src="/logo/studio_agovinoangrisano_logo.png"
                alt="Logo Studio Agovino & Angrisano"
                width={320}
                height={120}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Agenda del giorno
              </p>
              <h1 className="text-2xl font-semibold capitalize text-zinc-900">{printableDate}</h1>
              {selectedDoctor && selectedDoctor !== "all" ? (
                <p className="text-xs text-zinc-500">Medico: {selectedDoctor}</p>
              ) : null}
            </div>
          </div>
          <PrintButton
            className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600 print:hidden"
            label="Stampa appuntamenti"
          />
        </div>

        <div className="relative overflow-x-auto rounded-2xl border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-100 text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              <tr>
                <th className="px-4 py-3 text-left">Ora</th>
                <th className="px-4 py-3 text-left">Persona</th>
                <th className="px-4 py-3 text-left">Medico assegnato</th>
                <th className="px-4 py-3 text-left">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {dayAppointments.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-zinc-600" colSpan={4}>
                    Nessun appuntamento per la data selezionata.
                  </td>
                </tr>
              ) : (
                dayAppointments.map((appointment) => (
                  <tr key={appointment.id}>
                    <td className="px-4 py-3 text-zinc-700">
                      {new Intl.DateTimeFormat(LOCALE, {
                        timeZone: TIME_ZONE,
                        timeStyle: "short",
                      }).format(appointment.startsAt)}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {appointment.patient.lastName} {appointment.patient.firstName}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {appointment.doctor?.fullName ?? "Da assegnare"}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {appointment.title || appointment.serviceType || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
