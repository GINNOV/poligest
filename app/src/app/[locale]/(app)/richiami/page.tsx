import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { sendSms } from "@/lib/sms";
import { NotificationChannel, Prisma, RecallStatus, Role } from "@prisma/client";

// Stubbed email sender; replace with real provider integrations.
async function sendEmail(to: string, subject: string, body: string) {
  console.log("[manual] email", { to, subject, body });
}

function isNextRedirectError(err: unknown): err is { digest: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

async function createRecallRule(formData: FormData) {
  "use server";

  await requireUser([Role.ADMIN, Role.MANAGER]);
  const name = (formData.get("name") as string)?.trim();
  const serviceType = (formData.get("serviceType") as string)?.trim();
  const intervalDays = Number(formData.get("intervalDays"));
  const message = (formData.get("message") as string)?.trim() || null;
  const emailSubject = (formData.get("emailSubject") as string)?.trim() || null;
  const channelRaw = (formData.get("channel") as string) || NotificationChannel.EMAIL;
  const channel = Object.values(NotificationChannel).includes(channelRaw as NotificationChannel)
    ? (channelRaw as NotificationChannel)
    : NotificationChannel.EMAIL;
  if (!name || !serviceType || Number.isNaN(intervalDays) || intervalDays <= 0) {
    throw new Error("Dati regola non validi");
  }

  const data: Record<string, unknown> = { name, serviceType, intervalDays, message, emailSubject, channel };
  try {
    await prisma.recallRule.create({ data: data as Prisma.RecallRuleCreateInput });
  } catch (err: unknown) {
    if (err instanceof Error) {
      const msg = err.message;
      if (msg.includes("Unknown argument `emailSubject`")) {
        delete data.emailSubject;
      }
      if (msg.includes("Unknown argument `channel`")) {
        delete data.channel;
      }
      await prisma.recallRule.create({ data: data as Prisma.RecallRuleCreateInput });
      return;
    }
    throw err;
  }
  revalidatePath("/richiami");
}

async function scheduleRecall(formData: FormData) {
  "use server";

  await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const patientId = formData.get("patientId") as string;
  const ruleId = formData.get("ruleId") as string;
  const dueAt = formData.get("dueAt") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;
  if (!patientId || !ruleId || !dueAt) throw new Error("Dati mancanti");

  await prisma.recall.create({
    data: {
      patientId,
      ruleId,
      dueAt: new Date(dueAt),
      status: RecallStatus.PENDING,
      notes,
    },
  });
  revalidatePath("/richiami");
}

async function deleteRecallRule(formData: FormData) {
  "use server";

  await requireUser([Role.ADMIN]);
  const ruleId = formData.get("ruleId") as string;
  if (!ruleId) throw new Error("Regola non valida");

  await prisma.$transaction([
    prisma.recall.deleteMany({ where: { ruleId } }),
    prisma.recallRule.delete({ where: { id: ruleId } }),
  ]);
  revalidatePath("/richiami");
}

async function deleteScheduledRecall(formData: FormData) {
  "use server";

  await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const recallId = formData.get("recallId") as string;
  if (!recallId) throw new Error("Richiamo non valido");

  await prisma.recall.delete({ where: { id: recallId } });
  revalidatePath("/richiami");
}

async function sendManualNotification(formData: FormData) {
  "use server";

  try {
    const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
    const notificationType = (formData.get("notificationType") as string) || "appointment";
    const channel = (formData.get("channel") as string) || "EMAIL";
    const messageInput = (formData.get("message") as string)?.trim() || "";
    const emailSubjectInput = (formData.get("emailSubject") as string)?.trim() || "";

    let patient: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      phone: string | null;
    } | null = null;
    let message = messageInput;
    let emailSubject = emailSubjectInput;
    let eventLabel = "";
    let eventDate: Date | null = null;

    if (notificationType === "appointment") {
      const appointmentId = (formData.get("appointmentId") as string) || "";
      if (!appointmentId) throw new Error("Seleziona un appuntamento.");

      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        },
      });
      if (!appointment) throw new Error("Appuntamento non trovato.");
      patient = appointment.patient;
      eventLabel = appointment.title || "Appuntamento";
      eventDate = appointment.startsAt;

      if (!emailSubject) {
        emailSubject = "Promemoria appuntamento";
      }
    } else {
      const patientId = (formData.get("patientId") as string) || "";
      const eventTitle = (formData.get("eventTitle") as string)?.trim() || "";
      const eventAtRaw = (formData.get("eventAt") as string)?.trim() || "";
      if (!patientId) throw new Error("Seleziona un paziente.");

      patient = await prisma.patient.findUnique({
        where: { id: patientId },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      });
      if (!patient) throw new Error("Paziente non trovato.");

      eventLabel = eventTitle || "Evento";
      const parsedEventDate = eventAtRaw ? new Date(eventAtRaw) : null;
      eventDate =
        parsedEventDate && !Number.isNaN(parsedEventDate.getTime()) ? parsedEventDate : null;

      if (!emailSubject) {
        emailSubject = eventTitle ? `Promemoria ${eventTitle}` : "Promemoria evento";
      }

      if (!message && (!eventTitle || !eventDate)) {
        throw new Error("Inserisci un messaggio o i dettagli dell'evento.");
      }
    }

    if (!patient) throw new Error("Destinatario non valido.");

    if (!message) {
      if (!eventDate) throw new Error("Inserisci un messaggio.");
      const dateLabel = new Intl.DateTimeFormat("it-IT", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(eventDate);
      const timeLabel = new Intl.DateTimeFormat("it-IT", {
        timeStyle: "short",
      }).format(eventDate);
      const name = `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim() || "paziente";
      message = `Gentile ${name}, promemoria: ${eventLabel} il ${dateLabel} alle ${timeLabel}.`;
    }

    const wantsEmail = channel === "EMAIL" || channel === "BOTH";
    const wantsSms = channel === "SMS" || channel === "BOTH";

    if (wantsEmail && !patient.email) {
      throw new Error("Email del paziente mancante.");
    }
    if (wantsSms && !patient.phone) {
      throw new Error("Numero di telefono del paziente mancante.");
    }

    if (wantsEmail && patient.email) {
      await sendEmail(patient.email, emailSubject || "Promemoria", message);
    }
    if (wantsSms && patient.phone) {
      await sendSms({
        to: patient.phone,
        body: message,
        patientId: patient.id,
        userId: user.id,
      });
    }

    await logAudit(user, {
      action: "notification.manual_sent",
      entity: "Patient",
      entityId: patient.id,
      metadata: { channel, notificationType },
    });

    revalidatePath("/richiami");
    redirect(`/richiami?manualSuccess=${encodeURIComponent("Notifica inviata con successo.")}`);
  } catch (err: unknown) {
    if (isNextRedirectError(err)) throw err;
    const message =
      typeof (err as { message?: unknown })?.message === "string"
        ? ((err as { message: string }).message ?? "")
        : "Impossibile inviare la notifica.";
    redirect(`/richiami?manualError=${encodeURIComponent(message)}`);
  }
}

export default async function RichiamiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const params = await searchParams;
  const qParam = params.q;
  const qValue =
    typeof qParam === "string"
      ? qParam.trim()
      : Array.isArray(qParam)
        ? qParam[0]?.trim()
        : "";
  const query = qValue || undefined;
  const manualErrorMessage =
    typeof params.manualError === "string" ? params.manualError : null;
  const manualSuccessMessage =
    typeof params.manualSuccess === "string" ? params.manualSuccess : null;
  const now = new Date();
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);

  const prismaModels = prisma as unknown as Record<string, unknown>;
  const serviceClient = prismaModels["service"] as
    | { findMany?: (args: unknown) => Promise<unknown[]> }
    | undefined;

  const [recalls, rules, patients, servicesRaw, upcomingAppointments] = await Promise.all([
    prisma.recall.findMany({
      where: {
        AND: [
          { status: { in: [RecallStatus.PENDING, RecallStatus.CONTACTED, RecallStatus.SKIPPED] } },
          { dueAt: { lte: soon } },
          query
            ? {
                OR: [
                  {
                    patient: {
                      OR: [
                        { firstName: { contains: query, mode: Prisma.QueryMode.insensitive } },
                        { lastName: { contains: query, mode: Prisma.QueryMode.insensitive } },
                        { email: { contains: query, mode: Prisma.QueryMode.insensitive } },
                        { phone: { contains: query, mode: Prisma.QueryMode.insensitive } },
                      ],
                    },
                  },
                  { notes: { contains: query, mode: Prisma.QueryMode.insensitive } },
                  { rule: { name: { contains: query, mode: Prisma.QueryMode.insensitive } } },
                  { rule: { serviceType: { contains: query, mode: Prisma.QueryMode.insensitive } } },
                ],
              }
            : {},
        ],
      },
      orderBy: { dueAt: "asc" },
      include: { patient: true, rule: true },
      take: 50,
    }),
    prisma.recallRule.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.patient.findMany({ orderBy: { lastName: "asc" } }),
    serviceClient?.findMany ? serviceClient.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
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
  const services = servicesRaw as Array<{ id: string; name: string }>;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Richiami & notifiche
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900">Automazioni e invii manuali</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Configura regole automatiche per i richiami e invia notifiche manuali per appuntamenti o eventi.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Richiami in scadenza</h2>
                <p className="text-sm text-zinc-600">
                  Elenco dei richiami programmati nei prossimi 30 giorni.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <form method="get" action="/richiami" className="flex items-center gap-2">
                  <input
                    type="search"
                    name="q"
                    defaultValue={query ?? ""}
                    placeholder="Cerca paziente, regola, note..."
                    className="h-10 w-64 rounded-full border border-zinc-200 px-4 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-xs font-semibold text-white transition hover:bg-emerald-600"
                  >
                    Cerca
                  </button>
                  {query ? (
                    <Link
                      href="/richiami"
                      className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-xs font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700"
                    >
                      Reset
                    </Link>
                  ) : null}
                </form>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                  {recalls.length} in coda
                </span>
              </div>
            </div>

            <div className="mt-4 divide-y divide-zinc-100">
              {recalls.length === 0 ? (
                <p className="py-4 text-sm text-zinc-600">Nessun richiamo imminente.</p>
              ) : (
                recalls.map((recall) => {
                  const overdue = recall.dueAt < now;
                  const statusLabel =
                    recall.status === RecallStatus.CONTACTED
                      ? "Consegnato"
                      : recall.status === RecallStatus.SKIPPED
                        ? "Problema"
                        : "Programmato";
                  const statusClasses =
                    recall.status === RecallStatus.CONTACTED
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : recall.status === RecallStatus.SKIPPED
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-amber-50 text-amber-700 border-amber-200";
                  return (
                    <div
                      key={recall.id}
                      className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-zinc-900">
                          {recall.patient.lastName} {recall.patient.firstName}
                        </span>
                        <span className="text-xs text-zinc-600">
                          {recall.rule.name} ·{" "}
                          {new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(recall.dueAt)}
                        </span>
                        {recall.notes ? (
                          <span className="text-xs text-zinc-500">{recall.notes}</span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses}`}
                        >
                          {statusLabel}
                        </span>
                        {overdue && recall.status === RecallStatus.PENDING ? (
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                            Scaduto
                          </span>
                        ) : null}
                        <form
                          action={deleteScheduledRecall}
                          data-confirm="Eliminare definitivamente questo richiamo?"
                        >
                          <input type="hidden" name="recallId" value={recall.id} />
                          <button
                            type="submit"
                            className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-800"
                          >
                            Elimina
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <details className="group rounded-2xl border border-zinc-200 bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Regole automatiche</h2>
                <p className="text-sm text-zinc-600">
                  Definisci il canale, il servizio e l&apos;intervallo per i richiami automatici.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                  {rules.length} regole
                </span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-5 w-5 text-zinc-400 transition group-open:rotate-180"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </summary>

            <div className="px-6 pb-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr,0.9fr]">
                <form action={createRecallRule} className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <label className="flex flex-col gap-2 sm:col-span-2">
                    <span className="text-xs font-semibold uppercase text-zinc-500">Nome regola</span>
                    <input
                      name="name"
                      placeholder="Es. Igiene semestrale"
                      required
                      className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase text-zinc-500">Servizio</span>
                    <select
                      name="serviceType"
                      required
                      className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Seleziona servizio
                      </option>
                      {services.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase text-zinc-500">Intervallo (giorni)</span>
                    <input
                      name="intervalDays"
                      type="number"
                      min="1"
                      placeholder="Es. 180"
                      required
                      className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase text-zinc-500">Canale</span>
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
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase text-zinc-500">Oggetto email</span>
                    <input
                      name="emailSubject"
                      placeholder="Facoltativo"
                      className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>
                  <label className="flex flex-col gap-2 sm:col-span-2">
                    <span className="text-xs font-semibold uppercase text-zinc-500">Messaggio</span>
                    <textarea
                      name="message"
                      placeholder="Facoltativo: se vuoto useremo un messaggio standard."
                      className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      rows={3}
                    />
                  </label>
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 sm:col-span-2"
                  >
                    Salva regola automatica
                  </button>
                </form>

                <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-700">
                    Regole esistenti
                  </p>
                  <div className="mt-3 space-y-2 text-sm">
                    {rules.length === 0 ? (
                      <p className="text-xs text-zinc-500">Nessuna regola configurata.</p>
                    ) : (
                      rules.map((rule) => {
                        const extras = rule as unknown as { channel?: string | null; emailSubject?: string | null };
                        const channel = extras.channel ?? "EMAIL";
                        const emailSubject = extras.emailSubject ?? null;
                        return (
                          <form
                            key={rule.id}
                            action={deleteRecallRule}
                            className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2"
                            data-confirm="Eliminare definitivamente questa regola di richiamo?"
                          >
                            <div>
                              <p className="font-semibold text-zinc-900">{rule.name}</p>
                              <p className="text-xs text-zinc-600">
                                {rule.serviceType} · ogni {rule.intervalDays} giorni · {channel}
                              </p>
                              {emailSubject ? (
                                <p className="text-[11px] text-zinc-500">Oggetto email: {emailSubject}</p>
                              ) : null}
                            </div>
                            <input type="hidden" name="ruleId" value={rule.id} />
                            <button
                              type="submit"
                              className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-800"
                            >
                              Elimina
                            </button>
                          </form>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </details>

          <details className="group rounded-2xl border border-zinc-200 bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Programma richiamo manuale</h2>
                <p className="text-sm text-zinc-600">
                  Aggiungi manualmente un richiamo collegato a una regola esistente.
                </p>
              </div>
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5 text-zinc-400 transition group-open:rotate-180"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z"
                  clipRule="evenodd"
                />
              </svg>
            </summary>

            <div className="px-6 pb-6">
              <form action={scheduleRecall} className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <select
                  name="patientId"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 sm:col-span-2"
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
                <select
                  name="ruleId"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Seleziona regola
                  </option>
                  {rules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <input
                  name="dueAt"
                  type="date"
                  required
                  className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
                <input
                  name="notes"
                  placeholder="Note (opzionali)"
                  className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 sm:col-span-2"
                />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 sm:col-span-2"
                >
                  Aggiungi richiamo
                </button>
              </form>
            </div>
          </details>
        </div>

        <div className="space-y-6">
          <details className="group rounded-2xl border border-zinc-200 bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Invio promemoria manuale</h2>
                <p className="text-sm text-zinc-600">
                  Invia promemoria per appuntamenti imminenti o notifiche per eventi speciali.
                </p>
              </div>
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5 text-zinc-400 transition group-open:rotate-180"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z"
                  clipRule="evenodd"
                />
              </svg>
            </summary>

            <div className="px-6 pb-6">
              {manualSuccessMessage ? (
                <div className="mt-1 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {manualSuccessMessage}
                </div>
              ) : null}
              {manualErrorMessage ? (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {manualErrorMessage}
                </div>
              ) : null}

              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                  <h3 className="text-sm font-semibold text-zinc-900">Promemoria appuntamento</h3>
                  <form action={sendManualNotification} className="mt-3 space-y-3 text-sm">
                    <input type="hidden" name="notificationType" value="appointment" />
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
                          · {appt.patient.lastName} {appt.patient.firstName} ·{" "}
                          {appt.doctor?.fullName ?? "—"}
                        </option>
                      ))}
                    </select>
                    <select
                      name="channel"
                      required
                      defaultValue="SMS"
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

                <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                  <h3 className="text-sm font-semibold text-zinc-900">Notifica evento</h3>
                  <form action={sendManualNotification} className="mt-3 space-y-3 text-sm">
                    <input type="hidden" name="notificationType" value="event" />
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
                      defaultValue="SMS"
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
                      placeholder="Messaggio (facoltativo). Se vuoto, usa titolo e data evento."
                      className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      rows={3}
                    />
                    <button
                      type="submit"
                      className="inline-flex w-full items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
                    >
                      Invia notifica
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
