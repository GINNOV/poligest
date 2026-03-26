import Link from "next/link";
import Image from "next/image";
import { AppointmentStatus, Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { AppointmentUpdateForm } from "@/components/appointment-update-form";
import { AgendaFilters } from "@/components/agenda-filters";
import { normalizeItalianPhone } from "@/lib/phone";
import { AppointmentStatusAutoSubmit } from "@/components/appointment-status-auto-submit";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { renderWhatsappTemplate } from "@/lib/whatsapp-template";
import {
  deleteAppointmentAction,
  getAgendaPageData,
  updateAppointmentAction,
  updateAppointmentStatusAction,
} from "@/lib/appointments/agenda";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const formatLocalInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

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

const statusCardBackgrounds: Record<AppointmentStatus, string> = {
  TO_CONFIRM: "border-amber-200 bg-gradient-to-r from-amber-50 via-white to-amber-50",
  CONFIRMED: "border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50",
  IN_WAITING: "border-zinc-200 bg-gradient-to-r from-zinc-50 via-white to-zinc-50",
  IN_PROGRESS: "border-sky-200 bg-gradient-to-r from-sky-50 via-white to-sky-50",
  COMPLETED: "border-green-200 bg-gradient-to-r from-green-50 via-white to-green-50",
  CANCELLED: "border-rose-200 bg-gradient-to-r from-rose-50 via-white to-rose-50",
  NO_SHOW: "border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50",
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
    date.toDateString() === target.toDateString();
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
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Appuntamenti</h2>
        {successMessage ? (
          <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
        <AgendaFilters
          statusLabels={statusLabels}
          statusValue={statusValue}
          dateValue={dateValue}
          searchValue={searchValue}
        />
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-700">
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
          {orderedAppointments.length === 0 ? (
            <p className="py-4 text-sm text-zinc-600">Nessun appuntamento.</p>
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
              const cardClass = isPast
                ? "border-amber-200 bg-amber-50"
                : statusCardBackgrounds[appt.status];
              const dayKey = new Intl.DateTimeFormat("it-IT", { dateStyle: "long" }).format(
                appt.startsAt
              );
              const prevAppt = index > 0 ? orderedAppointments[index - 1] : null;
              const prevDayKey = prevAppt
                ? new Intl.DateTimeFormat("it-IT", { dateStyle: "long" }).format(prevAppt.startsAt)
                : null;
              const showDivider = !prevDayKey || prevDayKey !== dayKey;

              const outerCardClass = index % 2 === 0
                ? "border-zinc-200 bg-white/90"
                : "border-zinc-200 bg-zinc-50/80";

              return (
                <div key={appt.id}>
                  {showDivider ? (
                    <div className="mb-3 mt-2 flex items-center gap-3 text-xs font-semibold text-zinc-500">
                      <div className="h-px flex-1 bg-zinc-200" />
                      <span className="rounded-full border border-zinc-200 bg-white px-3 py-1">
                        📅 {dayKey}
                      </span>
                      <div className="h-px flex-1 bg-zinc-200" />
                    </div>
                  ) : null}
                  <div className={`mb-4 rounded-2xl border p-4 shadow-sm ${outerCardClass}`}>
                    <div className={`rounded-2xl border p-4 shadow-sm ${cardClass}`}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-900">
                            <span>
                              {getServiceIcon(appt.serviceType, appt.title)} {appt.title}
                            </span>
                            {isPast ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                ✅ Passato
                              </span>
                            ) : null}
                          </div>
                          <div className="grid gap-2 text-sm text-zinc-800 sm:grid-cols-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-zinc-500">Paziente</span>
                              <Link
                                href={`/pazienti/${appt.patientId}`}
                                className="font-semibold hover:text-emerald-700"
                              >
                                {appt.patient.lastName} {appt.patient.firstName}
                              </Link>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-zinc-500">Medico</span>
                              <span className="font-semibold">{appt.doctor?.fullName ?? "—"}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-zinc-500">Quando</span>
                              <span>
                                {new Intl.DateTimeFormat("it-IT", {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                }).format(appt.startsAt)}{" "}
                                alle {new Intl.DateTimeFormat("it-IT", { timeStyle: "short" }).format(appt.startsAt)}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-zinc-500">Durata</span>
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
                          {whatsappHref ? (
                            <a
                              href={whatsappHref}
                              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-full bg-emerald-700 px-3 text-xs font-semibold text-white transition hover:bg-emerald-600"
                            >
                              <Image src="/whatsapp.png" alt="" width={18} height={18} />
                              Promemoria
                            </a>
                          ) : (
                            <span className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-full bg-emerald-700/60 px-3 text-xs font-semibold text-white opacity-70">
                              <Image src="/whatsapp.png" alt="" width={18} height={18} />
                              Promemoria
                            </span>
                          )}
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
                    <details className="mt-4 rounded-xl border border-zinc-200 bg-white/70 p-3 text-xs text-zinc-700">
                      <summary className="cursor-pointer font-semibold text-emerald-800">
                        Modifica appuntamento
                      </summary>
                      <AppointmentUpdateForm
                        appointment={{
                          id: appt.id,
                          title: appt.title,
                          serviceType: appt.serviceType,
                          startsAt: formatLocalInput(appt.startsAt),
                          endsAt: formatLocalInput(appt.endsAt),
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
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          <p>
            Mostrati{" "}
            {totalCount === 0 ? "0" : `${showingFrom}-${Math.min(showingTo, totalCount)}`} di{" "}
            {totalCount}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={buildPageHref(page - 1)}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700"
              >
                ← Precedente
              </Link>
            ) : (
              <span className="rounded-full border border-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-400">
                ← Precedente
              </span>
            )}
            <span className="text-xs font-semibold text-zinc-600">
              Pagina {page} di {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={buildPageHref(page + 1)}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700"
              >
                Successiva →
              </Link>
            ) : (
              <span className="rounded-full border border-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-400">
                Successiva →
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
