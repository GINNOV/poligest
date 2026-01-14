import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AppointmentStatus, Prisma, Role } from "@prisma/client";
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
import {
  DEFAULT_WHATSAPP_TEMPLATE,
  WHATSAPP_TEMPLATE_NAME,
} from "@/lib/whatsapp-template";
import { DashboardAppointmentsList } from "@/components/dashboard-appointments-list";

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

const statusLegendItems = Object.entries(statusLabels) as Array<[AppointmentStatus, string]>;
const LOCALE = "it-IT";
const TIME_ZONE = "Europe/Rome";
const DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const formatDate = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: TIME_ZONE }).format(date);
const getDateKey = (date: Date) => DATE_KEY_FORMATTER.format(date);
const formatLocalDateTime = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

type StatCardProps = { label: string; value: number };

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-zinc-600">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}

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
      : getDateKey(today);

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

  const uniquePatientsWeek = new Set(appointments.map((a) => a.patientId)).size;

  const perDay = days.map((day) => {
    const key = getDateKey(day);
    const dayAppointments = appointments.filter(
      (appt) => getDateKey(appt.startsAt) === key
    );
    const uniquePatients = new Set(dayAppointments.map((a) => a.patientId)).size;
    return {
      key,
      label: formatDate(day, { weekday: "short", day: "numeric" }),
      count: uniquePatients,
    };
  });

  const maxCount = Math.max(...perDay.map((d) => d.count), 1);
  const getDayBubbleClass = (count: number) => {
    if (count < 10) return "bg-emerald-200";
    const ratio = count / maxCount;
    if (ratio <= 0.2) return "bg-emerald-200";
    if (ratio <= 0.4) return "bg-teal-200";
    if (ratio <= 0.6) return "bg-amber-200";
    if (ratio <= 0.8) return "bg-orange-200";
    return "bg-rose-200";
  };
  const selectedAppointments = appointments.filter(
    (appt) => getDateKey(appt.startsAt) === selectedDay
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
    doctor: appt.doctor?.fullName ? { fullName: appt.doctor.fullName } : null,
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
      ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(latestQuote.signedAt)
      : null;

    return (
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-sm text-zinc-600">{t("welcome")}</p>
          <h1 className="text-3xl font-semibold text-zinc-900">
            {user.name ?? user.email}
          </h1>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">I tuoi appuntamenti</h2>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              {appointments.length}
            </span>
          </div>

          <div className="mt-4 space-y-6">
            <section>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                  Prossimi appuntamenti
                </p>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                  {upcomingAppointments.length}
                </span>
              </div>
              <div className="mt-3 space-y-3">
                {upcomingAppointments.length === 0 ? (
                  <p className="py-4 text-sm text-zinc-600">{t("empty")}</p>
                ) : (
                  upcomingAppointments.map((appt) => (
                    <div
                      key={appt.id}
                      className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="space-y-1 text-sm text-zinc-800">
                          <p className="font-semibold text-zinc-900">
                            {getServiceIcon(appt.serviceType, appt.title)} {appt.title}
                          </p>
                          <p>
                            🧑‍⚕️ Dottore{" "}
                            <span className="font-semibold">{appt.doctor?.fullName ?? "—"}</span> il{" "}
                            {new Intl.DateTimeFormat("it-IT", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }).format(appt.startsAt)}{" "}
                            alle {new Intl.DateTimeFormat("it-IT", { timeStyle: "short" }).format(appt.startsAt)}.
                          </p>
                          <p className="text-zinc-700">
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
                            <p className="text-zinc-700">
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
                <p className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
                  Appuntamenti passati
                </p>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                  {pastAppointments.length}
                </span>
              </div>
              <div className="mt-3 space-y-3">
                {pastAppointments.length === 0 ? (
                  <p className="py-4 text-sm text-zinc-600">Nessun appuntamento passato.</p>
                ) : (
                  pastAppointments.map((appt) => (
                    <div
                      key={appt.id}
                      className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="space-y-1 text-sm text-zinc-800">
                          <p className="font-semibold text-zinc-900">
                            {getServiceIcon(appt.serviceType, appt.title)} {appt.title}
                          </p>
                          <p>
                            🧑‍⚕️ Dottore{" "}
                            <span className="font-semibold">{appt.doctor?.fullName ?? "—"}</span> il{" "}
                            {new Intl.DateTimeFormat("it-IT", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }).format(appt.startsAt)}{" "}
                            alle {new Intl.DateTimeFormat("it-IT", { timeStyle: "short" }).format(appt.startsAt)}.
                          </p>
                          {appt.notes ? (
                            <p className="text-zinc-700">
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
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Preventivo più recente</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Qui trovi il preventivo firmato più aggiornato.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              {quoteSignedAt ?? "—"}
            </span>
          </div>
          {latestQuote ? (
            <div className="relative mt-4 overflow-x-auto rounded-2xl border border-zinc-200">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white/90 to-transparent sm:hidden" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white/90 to-transparent sm:hidden" />
              <table className="min-w-full divide-y divide-zinc-100 text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
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
                      <td className="px-4 py-3 text-zinc-900">{item.serviceName}</td>
                      <td className="px-4 py-3 text-right text-zinc-700">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-zinc-700">
                        {Number(item.price?.toString?.() ?? item.price ?? 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-900">
                        {Number(item.total?.toString?.() ?? item.total ?? 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center text-zinc-700">
                        {item.saldato ? "Sì" : "No"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-zinc-50">
                  <tr>
                    <td
                      className="px-4 py-3 text-right text-sm font-semibold text-zinc-700"
                      colSpan={4}
                    >
                      Totale da saldare
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-900">
                      {quoteTotal.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-600">Nessun preventivo disponibile al momento.</p>
          )}
        </section>
        <section className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-emerald-900">Premi e motivazione</h2>
            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-700">
              {patientAwards.length}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {patientAwards.map((award) => (
                <div
                  key={award.key}
                  className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 flex-shrink-0 place-items-center overflow-hidden rounded-2xl bg-emerald-50 text-2xl leading-none text-center whitespace-nowrap">
                      {award.icon}
                    </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">{award.title}</p>
                    <p className="mt-1 text-sm text-emerald-800">{award.quote}</p>
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
          <p className="text-sm text-zinc-600">{t("welcome")}</p>
          <h1 className="text-3xl font-semibold text-zinc-900">
            {user.name ?? user.email}
          </h1>
          <p className="mt-2 text-sm italic text-zinc-600">
            “{getDailyQuote(today).text}”
            <span className="ml-2 text-xs font-semibold text-zinc-500">
              — {getDailyQuote(today).author}
            </span>
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-zinc-900">
            Appuntamenti di questa settimana
          </h2>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            {format(weekStart, "d MMM", { locale: it })} -{" "}
            {format(weekEnd, "d MMM", { locale: it })}
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-600">
          Clicca su un giorno per mostrare, nella lista sottostante, solo gli appuntamenti di quella data.
        </p>
        <div className="mt-4 grid grid-cols-7 items-end gap-2 sm:gap-3">
          {perDay.map((day) => (
            <Link
              key={day.key}
              href={`/dashboard?view=day&day=${day.key}`}
              className={`flex flex-col items-center gap-2 rounded-xl border px-2 py-2 transition ${
                day.key === selectedDay
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-zinc-100 bg-white hover:border-emerald-100"
              }`}
            >
              <div
                className={`w-full rounded-full ${getDayBubbleClass(day.count)}`}
                style={{ height: `${Math.max((day.count / maxCount) * 120, 8)}px` }}
              />
              <span className="text-xs font-semibold text-zinc-800">{day.label}</span>
              <span className="text-[11px] text-zinc-600">{day.count} paz.</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-zinc-900">Filtra per...</h2>
            <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-800">
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
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            {listAppointments.length} appuntamenti
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-700">
          <span className="font-semibold uppercase tracking-wide text-zinc-500">Legenda colori</span>
          {statusLegendItems.map(([status, label]) => (
            <span
              key={status}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold ${statusClasses[status]}`}
            >
              <span className="h-2 w-2 rounded-full bg-current" />
              {label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
            <span className="h-2 w-2 rounded-full bg-amber-600" />
            Passato ✅
          </span>
        </div>
        <div className="mt-4 divide-y divide-zinc-100">
          <DashboardAppointmentsList
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
