import Link from "next/link";
import { AppointmentStatus, Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { AppointmentUpdateForm } from "@/components/appointment-update-form";
import { AgendaFilters } from "@/components/agenda-filters";
import { normalizeItalianPhone } from "@/lib/phone";
import { AppointmentStatusAutoSubmit } from "@/components/appointment-status-auto-submit";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { renderWhatsappTemplate } from "@/lib/whatsapp-template";
import { AgendaReminderButton } from "@/components/agenda-reminder-button";
import {
  deleteAppointmentAction,
  updateAppointmentAction,
  updateAppointmentStatusAction,
} from "@/lib/appointments/agenda-actions";
import {
  getAgendaPageData,
} from "@/lib/appointments/agenda";
import { getUserDisplayTimeZone } from "@/lib/user-display-time-zone.server";
import {
  formatDateInDisplayTimeZone,
  formatDateInputValueInTimeZone,
} from "@/lib/user-display-time-zone";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const formatLocalInput = (date: Date, timeZone: string) =>
  `${formatDateInputValueInTimeZone(date, timeZone)}T${formatDateInDisplayTimeZone(
    date,
    { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
    timeZone
  )}`;

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

const statusCardBackgrounds: Record<AppointmentStatus, string> = {
  TO_CONFIRM: "border-amber-200 bg-gradient-to-r from-amber-50 via-white to-amber-50 dark:border-amber-800/60 dark:from-amber-900/20 dark:via-zinc-950 dark:to-amber-900/20",
  CONFIRMED: "border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 dark:border-emerald-800/60 dark:from-emerald-900/20 dark:via-zinc-950 dark:to-emerald-900/20",
  IN_WAITING: "border-zinc-200 bg-gradient-to-r from-zinc-50 via-white to-zinc-50 dark:border-zinc-800/60 dark:from-zinc-900/20 dark:via-zinc-950 dark:to-zinc-900/20",
  IN_PROGRESS: "border-sky-200 bg-gradient-to-r from-sky-50 via-white to-sky-50 dark:border-sky-800/60 dark:from-sky-900/20 dark:via-zinc-950 dark:to-sky-900/20",
  COMPLETED: "border-teal-200 bg-gradient-to-r from-teal-50 via-white to-teal-50 dark:border-teal-800/60 dark:from-teal-900/20 dark:via-zinc-950 dark:to-teal-900/20",
  CANCELLED: "border-rose-200 bg-gradient-to-r from-rose-50 via-white to-rose-50 dark:border-rose-800/60 dark:from-rose-900/20 dark:via-zinc-950 dark:to-rose-900/20",
  NO_SHOW: "border-violet-200 bg-gradient-to-r from-violet-50 via-white to-violet-50 dark:border-violet-800/60 dark:from-violet-900/20 dark:via-zinc-950 dark:to-violet-900/20",
};
const statusLegendItems = Object.entries(statusLabels) as Array<[AppointmentStatus, string]>;

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

  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  await requireFeatureAccess(user.role, "agenda");
  const displayTimeZone = await getUserDisplayTimeZone();

  const dateFilter = dateValue;
  const searchValue =
    typeof params.q === "string" ? params.q : Array.isArray(params.q) ? params.q[0] : "";
  const pageParam =
    typeof params.page === "string"
      ? params.page
      : Array.isArray(params.page)
        ? params.page[0]
        : "1";
  const page = Math.max(1, Number.isNaN(Number(pageParam)) ? 1 : Number(pageParam));
  const {
    appointments,
    patients,
    doctors,
    serviceOptionObjects,
    whatsappTemplateBody,
    availabilityWindows,
    practiceClosures,
    practiceWeeklyClosures,
    totalCount,
    totalPages,
    showingFrom,
    showingTo,
  } = await getAgendaPageData({
    statusValue,
    dateValue: dateFilter,
    searchValue,
    pageParam,
  });
  const basePath = "/agenda/appuntamenti";
  const returnParams = new URLSearchParams();
  if (statusValue) returnParams.set("status", statusValue);
  if (dateValue) returnParams.set("date", dateValue);
  if (searchValue) returnParams.set("q", searchValue);
  if (pageParam && pageParam !== "1") returnParams.set("page", pageParam);
  const returnTo = returnParams.toString() ? `${basePath}?${returnParams.toString()}` : basePath;
  const buildPageHref = (targetPage: number) => {
    const query = new URLSearchParams();
    if (statusValue) query.set("status", statusValue);
    if (dateValue) query.set("date", dateValue);
    if (searchValue) query.set("q", searchValue);
    query.set("page", String(targetPage));
    return `/agenda/appuntamenti?${query.toString()}`;
  };
  const getServiceIcon = (serviceType?: string | null, title?: string | null) => {
    const label = `${serviceType ?? ""} ${title ?? ""}`.toLowerCase();
    if (label.includes("richiamo")) return "🔗";
    if (label.includes("prima visita")) return "📋";
    if (label.includes("urgente") || label.includes("urgenza")) return "🚨";
    if (label.includes("visita di controllo")) return "🔎";
    return "🗓️";
  };
  const now = new Date();
  const isSameDay = (date: Date, target: Date) =>
    formatDateInDisplayTimeZone(date, { dateStyle: "short" }, displayTimeZone) ===
    formatDateInDisplayTimeZone(target, { dateStyle: "short" }, displayTimeZone);
  const orderedAppointments = [
    ...appointments
      .filter((appt) => isSameDay(appt.startsAt, now))
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    ...appointments
      .filter((appt) => appt.startsAt > now && !isSameDay(appt.startsAt, now))
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    ...appointments
      .filter((appt) => appt.startsAt < now && !isSameDay(appt.startsAt, now))
      .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime()),
  ];
  const statusOptions = Object.values(AppointmentStatus).map((status) => ({
    value: status,
    label: statusLabels[status],
  }));

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Appuntamenti</h2>
        {successMessage ? (
          <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
            {successMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
            {errorMessage}
          </div>
        ) : null}
        <AgendaFilters
          statusLabels={statusLabels}
          statusValue={statusValue}
          dateValue={dateValue}
          searchValue={searchValue}
        />
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
          <span className="font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Legenda colori</span>
          {statusLegendItems.map(([status, label]) => (
            <span
              key={status}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold ${statusClasses[status]}`}
            >
              <span className="h-2 w-2 rounded-full bg-current" />
              {label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200">
            <span className="h-2 w-2 rounded-full bg-amber-600" />
            Passato ✅
          </span>
        </div>
        <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
          {orderedAppointments.length === 0 ? (
            <p className="py-4 text-sm text-zinc-600 dark:text-zinc-400">Nessun appuntamento.</p>
          ) : (
            orderedAppointments.map((appt, index) => {
              const patientPhone = normalizeItalianPhone(appt.patient.phone);
              const whatsappPhone = patientPhone ? patientPhone.replace(/^\+/, "") : null;
              const appointmentDoctor = appt.doctor?.fullName ?? "da definire";
              const whatsappAppointmentDate = new Intl.DateTimeFormat("it-IT", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: displayTimeZone,
              }).format(appt.startsAt);
              const whatsappMessage = renderWhatsappTemplate(whatsappTemplateBody, {
                firstName: appt.patient.firstName ?? "",
                lastName: appt.patient.lastName ?? "",
                doctorName: appointmentDoctor,
                appointmentDate: whatsappAppointmentDate,
                serviceType: appt.serviceType ?? "",
                notes: appt.notes ?? "",
              });
              const whatsappHref = whatsappPhone
                ? `whatsapp://send?phone=${whatsappPhone}&text=${encodeURIComponent(whatsappMessage)}`
                : null;
              const isPast = appt.endsAt < now;
              const cardClass = (appt.status === AppointmentStatus.CANCELLED || appt.status === AppointmentStatus.NO_SHOW)
                ? statusCardBackgrounds[appt.status]
                : isPast
                  ? "border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-900/20"
                  : statusCardBackgrounds[appt.status];
              const dayKey = formatDateInDisplayTimeZone(appt.startsAt, { dateStyle: "long" }, displayTimeZone);
              const prevAppt = index > 0 ? orderedAppointments[index - 1] : null;
              const prevDayKey = prevAppt
                ? formatDateInDisplayTimeZone(prevAppt.startsAt, { dateStyle: "long" }, displayTimeZone)
                : null;
              const showDivider = !prevDayKey || prevDayKey !== dayKey;

              const outerCardClass = index % 2 === 0
                ? "border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-950/90"
                : "border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/80";

              return (
                <div key={appt.id}>
                  {showDivider ? (
                    <div className="mb-3 mt-2 flex items-center gap-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                      <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                        📅 {dayKey}
                      </span>
                      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                    </div>
                  ) : null}
                  <div className={`mb-4 rounded-2xl border p-4 shadow-sm ${outerCardClass}`}>
                    <div className={`rounded-2xl border p-4 shadow-sm ${cardClass}`}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                            <span>
                              {getServiceIcon(appt.serviceType, appt.title)} {appt.title}
                            </span>
                            {isPast ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                                ✅ Passato
                              </span>
                            ) : null}
                          </div>
                          <div className="grid gap-2 text-sm text-zinc-800 dark:text-zinc-200 sm:grid-cols-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-zinc-500 dark:text-zinc-400">Paziente</span>
                              <Link
                                href={`/pazienti/${appt.patientId}`}
                                className="font-semibold hover:text-emerald-700 dark:hover:text-emerald-300"
                              >
                                {appt.patient.lastName} {appt.patient.firstName}
                              </Link>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-zinc-500 dark:text-zinc-400">Medico</span>
                              <span className="font-semibold">{appt.doctor?.fullName ?? "—"}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-zinc-500 dark:text-zinc-400">Quando</span>
                              <span>
                                {formatDateInDisplayTimeZone(
                                  appt.startsAt,
                                  {
                                    weekday: "short",
                                    day: "numeric",
                                    month: "short",
                                  },
                                  displayTimeZone
                                )}{" "}
                                alle{" "}
                                {formatDateInDisplayTimeZone(
                                  appt.startsAt,
                                  { timeStyle: "short" },
                                  displayTimeZone
                                )}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-zinc-500 dark:text-zinc-400">Durata</span>
                              <span>
                                {Math.max(
                                  1,
                                  Math.round(
                                    (appt.endsAt.getTime() - appt.startsAt.getTime()) / (1000 * 60 * 60)
                                  )
                                )}{" "}
                                ora/e
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="grid w-full grid-cols-2 gap-2 text-xs sm:w-auto">
                          <AgendaReminderButton
                            appointmentId={appt.id}
                            whatsappHref={whatsappHref}
                            initialReminderSent={appt.reminderSent}
                          />
                          <AppointmentStatusAutoSubmit
                            appointmentId={appt.id}
                            defaultValue={appt.status}
                            options={statusOptions}
                            action={updateAppointmentStatusAction}
                            returnTo={returnTo}
                            className="w-full"
                          />
                        </div>
                      </div>
                    </div>
                    <details className="mt-4 rounded-xl border border-zinc-200 bg-white/70 p-3 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300">
                      <summary className="cursor-pointer font-semibold text-emerald-800 dark:text-emerald-400">
                        Modifica appuntamento
                      </summary>
                      <AppointmentUpdateForm
                        appointment={{
                          id: appt.id,
                          title: appt.title,
                          serviceType: appt.serviceType,
                          startsAt: formatLocalInput(appt.startsAt, displayTimeZone),
                          endsAt: formatLocalInput(appt.endsAt, displayTimeZone),
                          patientId: appt.patientId,
                          doctorId: appt.doctorId,
                          status: appt.status,
                        }}
                        patients={patients}
                        doctors={doctors}
                        services={serviceOptionObjects}
                        availabilityWindows={availabilityWindows}
                        practiceClosures={practiceClosures}
                        practiceWeeklyClosures={practiceWeeklyClosures}
                        action={updateAppointmentAction}
                      />
                      <form
                        action={deleteAppointmentAction}
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
                </div>
              );
            })
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <p>
            Mostrati{" "}
            {totalCount === 0 ? "0" : `${showingFrom}-${Math.min(showingTo, totalCount)}`} di{" "}
            {totalCount}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={buildPageHref(page - 1)}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-emerald-800 dark:hover:text-emerald-300"
              >
                ← Precedente
              </Link>
            ) : (
              <span className="rounded-full border border-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
                ← Precedente
              </span>
            )}
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Pagina {page} di {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={buildPageHref(page + 1)}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-emerald-800 dark:hover:text-emerald-300"
              >
                Successiva →
              </Link>
            ) : (
              <span className="rounded-full border border-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
                Successiva →
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
