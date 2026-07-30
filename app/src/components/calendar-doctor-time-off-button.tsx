"use client";

import { useState } from "react";
import type { DoctorTimeOffRecord } from "@/lib/doctor-time-off";

type CalendarDoctorTimeOffButtonProps = {
  doctorId: string;
  doctorName: string;
  returnTo: string;
  displayTimeZone: string;
  timeOffs: DoctorTimeOffRecord[];
  createAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
};

function formatDateLabel(value: string, timeZone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function CalendarDoctorTimeOffButton({
  doctorId,
  doctorName,
  returnTo,
  displayTimeZone,
  timeOffs,
  createAction,
  deleteAction,
}: CalendarDoctorTimeOffButtonProps) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [title, setTitle] = useState("Ferie");

  const resetForm = () => {
    setStartDate("");
    setEndDate("");
    setTitle("Ferie");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-900 transition hover:border-amber-300 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:border-amber-800 dark:hover:bg-amber-950/50"
      >
        + FERIE STAFF
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
              resetForm();
            }
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  Ferie medico
                </p>
                <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{doctorName}</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Imposta uno o più giorni in cui il medico non è disponibile, indipendentemente dagli orari
                  settimanali.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600 transition hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-300"
              >
                Chiudi
              </button>
            </div>

            <form action={createAction} className="mt-5 space-y-4">
              <input type="hidden" name="doctorId" value={doctorId} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="timeZone" value={displayTimeZone} />

              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Descrizione
                <input
                  name="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                  placeholder="Ferie"
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Dal
                  <input
                    type="date"
                    name="startDate"
                    value={startDate}
                    onChange={(event) => {
                      setStartDate(event.target.value);
                      if (!endDate || endDate < event.target.value) {
                        setEndDate(event.target.value);
                      }
                    }}
                    required
                    className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Al
                  <input
                    type="date"
                    name="endDate"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(event) => setEndDate(event.target.value)}
                    required
                    className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                  />
                </label>
              </div>

              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-full bg-amber-600 px-5 text-sm font-semibold text-white transition hover:bg-amber-500"
              >
                Salva ferie
              </button>
            </form>

            <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Ferie programmate</h3>
              {timeOffs.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Nessun periodo di ferie impostato.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {timeOffs.map((timeOff) => (
                    <li
                      key={timeOff.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                          {timeOff.title?.trim() || "Ferie"}
                        </p>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                          {formatDateLabel(timeOff.startsAt, displayTimeZone)} –{" "}
                          {formatDateLabel(timeOff.endsAt, displayTimeZone)}
                        </p>
                      </div>
                      <form action={deleteAction}>
                        <input type="hidden" name="timeOffId" value={timeOff.id} />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <button
                          type="submit"
                          className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:border-rose-200 hover:text-rose-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-rose-900 dark:hover:text-rose-300"
                        >
                          Rimuovi
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}