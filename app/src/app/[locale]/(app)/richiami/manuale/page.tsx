import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { sendManualNotification } from "@/app/[locale]/(app)/richiami/actions";

export default async function RichiamiManualePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const params = await searchParams;
  const manualErrorMessage =
    typeof params.manualError === "string" ? params.manualError : null;
  const manualSuccessMessage =
    typeof params.manualSuccess === "string" ? params.manualSuccess : null;
  const now = new Date();
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);

  const [patients, upcomingAppointments] = await Promise.all([
    prisma.patient.findMany({ orderBy: { lastName: "asc" } }),
    prisma.appointment.findMany({
      where: { startsAt: { gte: now, lte: soon } },
      orderBy: { startsAt: "asc" },
      take: 50,
      include: {
        patient: { select: { firstName: true, lastName: true, id: true } },
        doctor: { select: { fullName: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Richiami</p>
          <h1 className="text-2xl font-semibold text-zinc-900">Promemoria manuali</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Invia notifiche per appuntamenti imminenti o eventi speciali.
          </p>
        </div>
        <Link
          href="/richiami"
          className="inline-flex items-center rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700"
        >
          Torna alle sezioni
        </Link>
      </div>

      {manualSuccessMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {manualSuccessMessage}
        </div>
      ) : null}
      {manualErrorMessage ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {manualErrorMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
          <h3 className="text-sm font-semibold text-zinc-900">Promemoria appuntamento</h3>
          <form action={sendManualNotification} className="mt-3 space-y-3 text-sm">
            <input type="hidden" name="notificationType" value="appointment" />
            <input type="hidden" name="returnTo" value="/richiami/manuale" />
            <select
              name="appointmentId"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              required
              defaultValue=""
              disabled={upcomingAppointments.length === 0}
            >
              <option value="" disabled>
                {upcomingAppointments.length === 0
                  ? "Nessun appuntamento nei prossimi 30 giorni"
                  : "Seleziona appuntamento"}
              </option>
              {upcomingAppointments.map((appt) => (
                <option key={appt.id} value={appt.id}>
                  {new Intl.DateTimeFormat("it-IT", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(appt.startsAt)}{" "}
                  · {appt.patient.lastName} {appt.patient.firstName} · {appt.doctor?.fullName ?? "—"}
                </option>
              ))}
            </select>
            <select
              name="channel"
              required
              defaultValue="EMAIL"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS</option>
              <option value="BOTH">Email + SMS</option>
            </select>
            <input
              name="emailSubject"
              placeholder="Oggetto email (facoltativo)"
              className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <textarea
              name="message"
              placeholder="Messaggio (facoltativo). Se vuoto, verrà usato un promemoria standard."
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              rows={3}
            />
            <button
              type="submit"
              disabled={upcomingAppointments.length === 0}
              className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Invia promemoria
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
          <h3 className="text-sm font-semibold text-zinc-900">Notifica evento</h3>
          <form action={sendManualNotification} className="mt-3 space-y-3 text-sm">
            <input type="hidden" name="notificationType" value="event" />
            <input type="hidden" name="returnTo" value="/richiami/manuale" />
            <select
              name="patientId"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
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
            <input
              name="eventTitle"
              placeholder="Titolo evento (es. Controllo annuale)"
              className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <input
              name="eventAt"
              type="datetime-local"
              className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <select
              name="channel"
              required
              defaultValue="EMAIL"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS</option>
              <option value="BOTH">Email + SMS</option>
            </select>
            <input
              name="emailSubject"
              placeholder="Oggetto email (facoltativo)"
              className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <textarea
              name="message"
              placeholder="Messaggio (facoltativo). Se vuoto, verrà usato un promemoria standard."
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              rows={3}
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              Invia notifica
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
