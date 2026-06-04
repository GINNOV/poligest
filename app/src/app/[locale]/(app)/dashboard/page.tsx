import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AppointmentStatus, Role } from "@prisma/client";

export const metadata: Metadata = {
  title: "DASHBOARD",
};
import { ASSISTANT_ROLE } from "@/lib/roles";
import {
  eachDayOfInterval,
  endOfWeek,
  format,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { it } from "date-fns/locale";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { DoctorFilter } from "@/components/doctor-filter";
import { PrintLinkButton } from "@/components/print-link-button";
import {
  DEFAULT_WHATSAPP_TEMPLATE,
  WHATSAPP_TEMPLATE_NAME,
} from "@/lib/whatsapp-template";
import { DashboardAppointmentsList } from "@/components/dashboard-appointments-list";
import { getUserDisplayTimeZone } from "@/lib/user-display-time-zone.server";
import { getAppointmentWhatsappReminderCounts } from "@/lib/appointments/agenda";

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
  TO_CONFIRM: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200",
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-200",
  IN_WAITING: "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800/60 dark:bg-zinc-900/20 dark:text-zinc-300",
  IN_PROGRESS: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800/60 dark:bg-sky-900/20 dark:text-sky-200",
  COMPLETED: "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-800/60 dark:bg-teal-900/20 dark:text-teal-200",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-900/20 dark:text-rose-200",
  NO_SHOW: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800/60 dark:bg-violet-900/20 dark:text-violet-300",
};

const statusLegendItems = Object.entries(statusLabels) as Array<[AppointmentStatus, string]>;
const LOCALE = "it-IT";
const formatDate = (date: Date, options: Intl.DateTimeFormatOptions, timeZone: string) =>
  new Intl.DateTimeFormat(LOCALE, { ...options, timeZone }).format(date);
const getDateKey = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
const formatLocalDateTime = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

type PatientAward = {
  key: string;
  title: string;
  icon: string;
  quote: string;
};

const DAILY_QUOTES = [
  {
    text: "Un sorriso caldo e' il linguaggio universale della gentilezza.",
    author: "William Arthur Ward",
  },
  {
    text: "Ogni volta che sorridi a qualcuno e' un atto d'amore, un dono a quella persona, una cosa bellissima.",
    author: "Madre Teresa",
  },
  {
    text: "Un sorriso e' una curva che raddrizza ogni cosa.",
    author: "Phyllis Diller",
  },
  {
    text: "A volte la tua gioia e' la fonte del tuo sorriso, ma a volte il tuo sorriso puo' essere la fonte della tua gioia.",
    author: "Thich Nhat Hanh",
  },
  {
    text: "Nulla di cio' che indossi e' piu' importante del tuo sorriso.",
    author: "Connie Stevens",
  },
  {
    text: "Un sorriso e' la felicita' che trovi proprio sotto il naso.",
    author: "Tom Wilson",
  },
  {
    text: "Le persone dimenticheranno cosa hai detto, dimenticheranno cosa hai fatto, ma non dimenticheranno mai come le hai fatte sentire.",
    author: "Maya Angelou",
  },
  {
    text: "Nessuno tiene a quanto sai, finche' non sa quanto ti importa.",
    author: "Theodore Roosevelt",
  },
  {
    text: "A volte cura, spesso tratta, sempre conforta.",
    author: "Ippocrate",
  },
  {
    text: "Spesso sottovalutiamo il potere di un tocco, di un sorriso, di una parola gentile, di un orecchio che ascolta, tutti capaci di cambiare una vita.",
    author: "Leo Buscaglia",
  },
  {
    text: "Nessun atto di gentilezza, per quanto piccolo, e' mai sprecato.",
    author: "Esopo",
  },
  {
    text: "L'empatia e' vedere con gli occhi di un altro, ascoltare con le orecchie di un altro, sentire con il cuore di un altro.",
    author: "Alfred Adler",
  },
  {
    text: "Da soli possiamo fare cosi' poco; insieme possiamo fare cosi' tanto.",
    author: "Helen Keller",
  },
  {
    text: "Le grandi cose in azienda non si fanno mai da soli. Le fanno i team di persone.",
    author: "Steve Jobs",
  },
  {
    text: "La forza della squadra e' ogni singolo membro. La forza di ogni membro e' la squadra.",
    author: "Phil Jackson",
  },
  {
    text: "Ritrovarsi e' un inizio, rimanere insieme e' un progresso, lavorare insieme e' un successo.",
    author: "Henry Ford",
  },
  {
    text: "Nessuno di noi e' intelligente quanto tutti noi.",
    author: "Ken Blanchard",
  },
  {
    text: "La sinergia e' l'attivita' piu' alta della vita: crea alternative nuove e inesplorate e valorizza le differenze mentali, emotive e psicologiche delle persone.",
    author: "Stephen Covey",
  },
  {
    text: "L'impegno individuale in uno sforzo di gruppo: e' questo che fa funzionare una squadra, un'azienda, una societa', una civilta'.",
    author: "Vince Lombardi",
  },
  {
    text: "La qualita' non e' un atto, e' un'abitudine.",
    author: "Aristotele",
  },
  {
    text: "La perfezione non e' raggiungibile, ma se perseguiamo la perfezione possiamo raggiungere l'eccellenza.",
    author: "Vince Lombardi",
  },
  {
    text: "Ogni dente nella testa di un uomo vale piu' di un diamante.",
    author: "Miguel de Cervantes",
  },
  {
    text: "L'eccellenza e' fare una cosa comune in modo non comune.",
    author: "Booker T. Washington",
  },
  {
    text: "Fai cio' che fai cosi' bene che vorranno rivederlo e porteranno gli amici.",
    author: "Walt Disney",
  },
  {
    text: "La vita e' breve. Sorridi finche' hai ancora i denti.",
    author: "Mallory Hopkins",
  },
];

function buildPatientAwards(appointments: Array<{ serviceType: string }>): PatientAward[] {
  const awards: PatientAward[] = [
    {
      key: "account",
      title: "Benvenuto a bordo",
      icon: "⭐",
      quote: "Hai creato l'account: il primo passo e' gia' una vittoria concreta.",
    },
  ];

  const serviceTypes = new Set(
    appointments
      .map((appt) => appt.serviceType?.toLowerCase().trim())
      .filter(Boolean)
  );

  const addAward = (award: PatientAward) => {
    if (!awards.some((item) => item.key === award.key)) {
      awards.push(award);
    }
  };

  for (const serviceType of serviceTypes) {
    if (serviceType.includes("igiene") || serviceType.includes("ablazione")) {
      addAward({
        key: "igiene",
        title: "Igiene da campione",
        icon: "💎💎💎",
        quote:
          "Tre diamanti alla tua costanza: \"Chi vo' campa' sano, tiene a mente 'a prevencione\".",
      });
      continue;
    }
    if (serviceType.includes("frenulectomia") || serviceType.includes("chirurgia") || serviceType.includes("estrazione")) {
      addAward({
        key: "coraggio",
        title: "Coraggio chirurgico",
        icon: "🛡️",
        quote:
          "Hai affrontato il trattamento con grinta: anche Napoleone sapeva che la calma vince la battaglia.",
      });
      continue;
    }
    if (serviceType.includes("otturazione") || serviceType.includes("protesi")) {
      addAward({
        key: "precisione",
        title: "Precisione premiata",
        icon: "🎯",
        quote:
          "Ogni dettaglio conta: hai puntato dritto al risultato, come un generale che sceglie il campo migliore.",
      });
    }
  }

  return awards;
}

function getServiceIcon(serviceType: string | null, title: string) {
  const s = (serviceType || title).toLowerCase();
  if (s.includes("igiene") || s.includes("ablazione")) return "💎";
  if (s.includes("chirurgia") || s.includes("estrazione") || s.includes("frenulectomia")) return "🛡️";
  if (s.includes("otturazione") || s.includes("protesi")) return "🎯";
  if (s.includes("visita") || s.includes("controllo")) return "🔍";
  if (s.includes("ortodonzia")) return "🦷";
  return "📅";
}

function getDailyQuote(date: Date) {
  const dayIndex = Math.abs(date.getDate() - 1) % DAILY_QUOTES.length;
  return DAILY_QUOTES[dayIndex];
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser([
    Role.ADMIN,
    Role.MANAGER,
    ASSISTANT_ROLE,
    Role.SECRETARY,
    Role.PATIENT,
  ]);
  const t = await getTranslations("dashboard");
  const isPatient = user.role === Role.PATIENT;
  const displayTimeZone = await getUserDisplayTimeZone();

  const patientRecord = isPatient && user.email
    ? await prisma.patient.findFirst({
        where: { email: { equals: user.email, mode: "insensitive" } },
        select: { id: true },
      })
    : null;
  const latestQuote = patientRecord
    ? await prisma.quote.findFirst({
        where: { patientId: patientRecord.id },
        orderBy: { createdAt: "desc" },
        include: { items: { orderBy: { createdAt: "asc" } } },
      })
    : null;

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const viewParam = typeof params.view === "string" ? params.view : undefined;
  const view = viewParam === "day" ? "day" : "week";

  const selectedDayParam = typeof params.day === "string" ? params.day : undefined;
  const selectedDay =
    selectedDayParam && !Number.isNaN(Date.parse(selectedDayParam))
      ? selectedDayParam
      : getDateKey(today, displayTimeZone);

  const [appointments, whatsappTemplate] = await Promise.all([
    prisma.appointment.findMany({
      where: isPatient
        ? {
            patient: {
              email: { equals: user.email ?? "", mode: "insensitive" },
            },
          }
        : {
            startsAt: { gte: weekStart, lte: weekEnd },
          },
      orderBy: { startsAt: isPatient ? "desc" : "asc" },
      include: {
        patient: { select: { firstName: true, lastName: true, id: true, photoUrl: true, phone: true } },
        doctor: { select: { fullName: true, specialty: true } },
      },
    }),
    prisma.smsTemplate.findUnique({
      where: { name: WHATSAPP_TEMPLATE_NAME },
    }),
  ]);
  const whatsappTemplateBody = whatsappTemplate?.body ?? DEFAULT_WHATSAPP_TEMPLATE;
  const perDay = days.map((day) => {
    const key = getDateKey(day, displayTimeZone);
    const dayAppointments = appointments.filter(
      (appt) => getDateKey(appt.startsAt, displayTimeZone) === key
    );
    const uniquePatients = new Set(dayAppointments.map((a) => a.patientId)).size;
    return {
      key,
      label: formatDate(day, { weekday: "short", day: "numeric" }, displayTimeZone),
      count: uniquePatients,
    };
  });

  const maxCount = Math.max(...perDay.map((d) => d.count), 1);
  const getDayBubbleClass = (count: number) => {
    if (count === 0) return "bg-zinc-100 dark:bg-zinc-800";
    if (count < 5) return "bg-emerald-100 dark:bg-emerald-900/40";
    const ratio = count / maxCount;
    if (ratio <= 0.2) return "bg-emerald-200 dark:bg-emerald-800/50";
    if (ratio <= 0.4) return "bg-teal-200 dark:bg-teal-800/50";
    if (ratio <= 0.6) return "bg-amber-200 dark:bg-amber-800/50";
    if (ratio <= 0.8) return "bg-orange-200 dark:bg-orange-800/50";
    return "bg-rose-200 dark:bg-rose-800/50";
  };
  const selectedAppointments = appointments.filter(
    (appt) => getDateKey(appt.startsAt, displayTimeZone) === selectedDay
  );
  const doctors = Array.from(
    new Map(
      appointments
        .filter((a) => a.doctor?.fullName)
        .map((a) => [a.doctor?.fullName ?? "", a.doctor?.fullName ?? ""])
    ).values()
  );
  const selectedDoctor =
    typeof params.doctor === "string"
      ? params.doctor
      : Array.isArray(params.doctor)
        ? params.doctor[0] ?? ""
        : "";
  const filteredByDoctor =
    selectedDoctor && selectedDoctor !== "all"
      ? (view === "day" ? selectedAppointments : appointments).filter(
          (appt) => (appt.doctor?.fullName ?? "") === selectedDoctor
        )
      : view === "day"
        ? selectedAppointments
        : appointments;
  const listAppointments = filteredByDoctor;
  const nowIso = today.toISOString();
  const reminderCounts = await getAppointmentWhatsappReminderCounts(listAppointments.map((appt) => appt.id));
  const appointmentsForList = listAppointments.map((appt) => ({
    id: appt.id,
    startsAt: formatLocalDateTime(appt.startsAt),
    endsAt: formatLocalDateTime(appt.endsAt),
    status: appt.status,
    title: appt.title,
    serviceType: appt.serviceType,
    notes: appt.notes,
    patient: {
      id: appt.patient.id,
      firstName: appt.patient.firstName,
      lastName: appt.patient.lastName,
      phone: appt.patient.phone,
    },
    doctor: appt.doctor?.fullName ? { id: appt.doctorId || "", fullName: appt.doctor.fullName } : null,
    reminderSent: (reminderCounts.get(appt.id) ?? 0) > 0,
    reminderSendCount: reminderCounts.get(appt.id) ?? 0,
  }));
  const todayStart = startOfDay(today);
  const upcomingAppointments = isPatient
    ? appointments
        .filter((appt) => appt.startsAt >= todayStart)
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    : [];
  const pastAppointments = isPatient
    ? appointments
        .filter((appt) => appt.startsAt < todayStart)
        .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
    : [];
  const patientAwards = isPatient ? buildPatientAwards(appointments) : [];
  const dashboardPrintHref = (() => {
    const printParams = new URLSearchParams({ day: selectedDay });
    if (selectedDoctor && selectedDoctor !== "all") {
      printParams.set("doctor", selectedDoctor);
    }
    return `/dashboard/print?${printParams.toString()}`;
  })();
  if (isPatient) {
    const quoteItems = latestQuote
      ? latestQuote.items.length
        ? latestQuote.items
        : [
            {
              id: latestQuote.id,
              serviceName: latestQuote.serviceName,
              quantity: latestQuote.quantity,
              price: latestQuote.price,
              total: latestQuote.total,
              saldato: false,
            },
          ]
      : [];
    const quoteTotal = quoteItems.reduce((sum, item) => {
      const totalValue = Number(item.total?.toString?.() ?? item.total ?? 0);
      return sum + (item.saldato ? 0 : totalValue);
    }, 0);
    const quoteSignedAt = latestQuote?.signedAt
      ? formatDate(latestQuote.signedAt, { dateStyle: "medium" }, displayTimeZone)
      : null;

    return (
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{t("welcome")}</p>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            {user.name ?? user.email}
          </h1>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">I tuoi appuntamenti</h2>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              {appointments.length}
            </span>
          </div>

          <div className="mt-4 space-y-6">
            <section>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Prossimi appuntamenti
                </p>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                  {upcomingAppointments.length}
                </span>
              </div>
              <div className="mt-3 space-y-3">
                {upcomingAppointments.length === 0 ? (
                  <p className="py-4 text-sm text-zinc-600 dark:text-zinc-300">{t("empty")}</p>
                ) : (
                  upcomingAppointments.map((appt) => (
                    <div
                      key={appt.id}
                      className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/25"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="space-y-1 text-sm text-zinc-800 dark:text-zinc-200">
                          <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                            {getServiceIcon(appt.serviceType, appt.title)} {appt.title}
                          </p>
                          <p>
                            🧑‍⚕️ Dottore{" "}
                            <span className="font-semibold">{appt.doctor?.fullName ?? "—"}</span> il{" "}
                            {formatDate(
                              appt.startsAt,
                              {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                              displayTimeZone
                            )}{" "}
                            alle {formatDate(appt.startsAt, { timeStyle: "short" }, displayTimeZone)}.
                          </p>
                          <p className="text-zinc-700 dark:text-zinc-300">
                            🕒 L&apos;appuntamento dovrebbe richiedere circa{" "}
                            {Math.max(
                              1,
                              Math.round(
                                (appt.endsAt.getTime() - appt.startsAt.getTime()) / 60000
                              )
                            )}{" "}
                            minuti.
                          </p>
                          {appt.notes ? (
                            <p className="text-zinc-700 dark:text-zinc-300">
                              📝 Note: {appt.notes}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                  Appuntamenti passati
                </p>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {pastAppointments.length}
                </span>
              </div>
              <div className="mt-3 space-y-3">
                {pastAppointments.length === 0 ? (
                  <p className="py-4 text-sm text-zinc-600 dark:text-zinc-300">Nessun appuntamento passato.</p>
                ) : (
                  pastAppointments.map((appt) => (
                    <div
                      key={appt.id}
                      className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="space-y-1 text-sm text-zinc-800 dark:text-zinc-200">
                          <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                            {getServiceIcon(appt.serviceType, appt.title)} {appt.title}
                          </p>
                          <p>
                            🧑‍⚕️ Dottore{" "}
                            <span className="font-semibold">{appt.doctor?.fullName ?? "—"}</span> il{" "}
                            {formatDate(
                              appt.startsAt,
                              {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                              displayTimeZone
                            )}{" "}
                            alle {formatDate(appt.startsAt, { timeStyle: "short" }, displayTimeZone)}.
                          </p>
                          {appt.notes ? (
                            <p className="text-zinc-700 dark:text-zinc-300">
                              📝 Note: {appt.notes}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Preventivo più recente</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Qui trovi il preventivo firmato più aggiornato.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              {quoteSignedAt ?? "—"}
            </span>
          </div>
          {latestQuote ? (
            <div className="relative mt-4 overflow-x-auto rounded-2xl border border-zinc-200">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white/90 to-transparent sm:hidden dark:from-zinc-950/90" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white/90 to-transparent sm:hidden dark:from-zinc-950/90" />
              <table className="min-w-full divide-y divide-zinc-100 text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                  <tr>
                    <th className="px-4 py-3 text-left">Prestazione</th>
                    <th className="px-4 py-3 text-right">Quantità</th>
                    <th className="px-4 py-3 text-right">Prezzo (€)</th>
                    <th className="px-4 py-3 text-right">Totale (€)</th>
                    <th className="px-4 py-3 text-center">Saldato</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {quoteItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">{item.serviceName}</td>
                      <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                        {Number(item.price?.toString?.() ?? item.price ?? 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-100">
                        {Number(item.total?.toString?.() ?? item.total ?? 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center text-zinc-700 dark:text-zinc-300">
                        {item.saldato ? "Sì" : "No"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    <td
                      className="px-4 py-3 text-right text-sm font-semibold text-zinc-700 dark:text-zinc-300"
                      colSpan={4}
                    >
                      Totale da saldare
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {quoteTotal.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">Nessun preventivo disponibile al momento.</p>
          )}
        </section>
        <section className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/25">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-300">Premi e motivazione</h2>
            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-zinc-900/80 dark:text-emerald-200">
              {patientAwards.length}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {patientAwards.map((award) => (
                <div
                  key={award.key}
                  className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900/40 dark:bg-zinc-900"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 flex-shrink-0 place-items-center overflow-hidden rounded-2xl bg-emerald-50 text-2xl leading-none text-center whitespace-nowrap dark:bg-emerald-950/40">
                      {award.icon}
                    </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">{award.title}</p>
                    <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">{award.quote}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{t("welcome")}</p>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            {user.name ?? user.email}
          </h1>
          <p className="mt-2 text-sm italic text-zinc-600 dark:text-zinc-300">
            “{getDailyQuote(today).text}”
              <span className="ml-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              — {getDailyQuote(today).author}
            </span>
          </p>
        </div>
        <PrintLinkButton
          href={dashboardPrintHref}
          label="Stampa"
          target="_blank"
          rel="noopener noreferrer"
          variant="primary"
          className="h-10 w-10 p-0 items-center justify-center rounded-full shrink-0"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9V2h12v7" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <path d="M6 14h12v8H6z" />
          </svg>
        </PrintLinkButton>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Appuntamenti di questa settimana
          </h2>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            {format(weekStart, "d MMM", { locale: it })} -{" "}
            {format(weekEnd, "d MMM", { locale: it })}
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Clicca su un giorno per mostrare, nella lista sottostante, solo gli appuntamenti di quella data.
        </p>
        <div className="mt-4 grid grid-cols-7 items-end gap-2 sm:gap-3">
          {perDay.map((day) => (
            <Link
              key={day.key}
              href={`/dashboard?view=day&day=${day.key}`}
              className={`flex flex-col items-center gap-2 rounded-xl border px-2 py-2 transition ${
                day.key === selectedDay
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30"
                  : "border-zinc-100 bg-white hover:border-emerald-100 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-900/40"
              }`}
            >
              <div
                className={`relative flex w-full items-center justify-center overflow-hidden rounded-full shadow-sm ring-1 ring-white/60 ${getDayBubbleClass(day.count)}`}
                style={{ height: `${Math.max((day.count / maxCount) * 120, 44)}px` }}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-[12%] top-[14%] h-2.5 rounded-full bg-white/30"
                />
                <span className="relative inline-flex min-w-[2.4rem] items-center justify-center rounded-full bg-white/55 px-2.5 py-1 text-sm font-semibold text-zinc-800 backdrop-blur-[2px] sm:text-base dark:bg-zinc-800/60 dark:text-zinc-50">
                  {day.count}
                </span>
              </div>
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{day.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Filtra per...</h2>
            <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              <Link
                href="/dashboard"
                className={`rounded-full px-2 py-1 ${
                  view === "week"
                    ? "bg-emerald-700 text-white"
                    : "hover:text-emerald-700"
                }`}
              >
                Settimana
              </Link>
              <Link
                href={`/dashboard?view=day&day=${selectedDay}`}
                className={`rounded-full px-2 py-1 ${
                  view === "day"
                  ? "bg-emerald-700 text-white"
                  : "hover:text-emerald-700"
                }`}
              >
                Oggi
              </Link>
            </div>
            {!isPatient && (
              <DoctorFilter doctors={doctors} selectedDoctor={selectedDoctor} />
            )}
          </div>
          <span className="self-start rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 sm:self-auto">
            {listAppointments.length} appuntamenti
          </span>
        </div>
        <details className="group mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 sm:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <span>LEGENDA COLORI</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 transition group-open:rotate-180"
            >
              <path d="m5 7 5 6 5-6" />
            </svg>
          </summary>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {statusLegendItems.map(([status, label]) => (
              <span
                key={status}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold ${statusClasses[status]}`}
              >
                <span className="h-2 w-2 rounded-full bg-current" />
                {label.toUpperCase()}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200">
              <span className="h-2 w-2 rounded-full bg-amber-600" />
              PASSATO ✅
            </span>
          </div>
        </details>
        <div className="mt-3 hidden flex-wrap items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 sm:flex">
          <span className="font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">LEGENDA COLORI</span>
          {statusLegendItems.map(([status, label]) => (
            <span
              key={status}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold ${statusClasses[status]}`}
            >
              <span className="h-2 w-2 rounded-full bg-current" />
              {label.toUpperCase()}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200">
            <span className="h-2 w-2 rounded-full bg-amber-600" />
            PASSATO ✅
          </span>        </div>
        <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
          <DashboardAppointmentsList
            key={appointmentsForList.map((appt) => appt.id).join("|")}
            appointments={appointmentsForList}
            whatsappTemplateBody={whatsappTemplateBody}
            nowIso={nowIso}
            emptyLabel={t("empty")}
          />
        </div>
      </section>
    </div>
  );
}
