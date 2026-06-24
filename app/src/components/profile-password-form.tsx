"use client";

import { useActionState, useState } from "react";
import type { ProfilePasswordFormState } from "@/lib/profile-password";

const inputClassName =
  "h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900";

function PasswordField({
  id,
  label,
  name,
  autoComplete,
  error,
}: {
  id: string;
  label: string;
  name: string;
  autoComplete: string;
  error?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
      {label}
      <div className="flex items-center gap-2">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          className={`${inputClassName} flex-1`}
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {visible ? "Nascondi" : "Mostra"}
        </button>
      </div>
      {error ? <span className="text-xs font-normal text-red-600 dark:text-red-400">{error}</span> : null}
    </label>
  );
}

export function ProfilePasswordForm({
  hasPassword,
  updateProfilePassword,
}: {
  hasPassword: boolean;
  updateProfilePassword: (
    prevState: ProfilePasswordFormState,
    formData: FormData,
  ) => Promise<ProfilePasswordFormState>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(updateProfilePassword, {});
  const showForm = isEditing && !state.success;

  const title = hasPassword ? "Password" : "Imposta password";
  const description = hasPassword
    ? "Aggiorna la password del tuo account."
    : "Imposta una password per accedere con email e password.";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{description}</p>

      {state.success ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
          {hasPassword ? "Password aggiornata con successo." : "Password impostata con successo."}
        </p>
      ) : null}

      {state.error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      ) : null}

      {!showForm ? (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-full border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-emerald-700 dark:hover:text-emerald-300"
        >
          {hasPassword ? "Cambia password" : "Imposta password"}
        </button>
      ) : (
        <form action={formAction} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PasswordField
            id="new-password"
            label="Nuova password"
            name="newPassword"
            autoComplete="new-password"
            error={state.fieldErrors?.newPassword}
          />

          <PasswordField
            id="new-password-repeat"
            label="Conferma nuova password"
            name="newPasswordRepeat"
            autoComplete="new-password"
            error={state.fieldErrors?.newPasswordRepeat}
          />

          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Salvataggio..." : hasPassword ? "Aggiorna password" : "Imposta password"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setIsEditing(false)}
              className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
            >
              Annulla
            </button>
          </div>
        </form>
      )}
    </div>
  );
}