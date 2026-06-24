"use client";

import { useState } from "react";
import { useStackApp, useUser } from "@stackframe/stack";
import { KnownErrors } from "@stackframe/stack-shared";
import { getPasswordError } from "@stackframe/stack-shared/dist/helpers/password";

const inputClassName =
  "h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900";

type FieldErrors = {
  oldPassword?: string;
  newPassword?: string;
  newPasswordRepeat?: string;
};

function formatPasswordError(error: KnownErrors["PasswordRequirementsNotMet"] | KnownErrors["PasswordConfirmationMismatch"]) {
  if (KnownErrors.PasswordConfirmationMismatch.isInstance(error)) {
    return "La password attuale non è corretta.";
  }
  if (KnownErrors.PasswordTooShort.isInstance(error)) {
    const minLength = error.constructorArgs[0];
    return `La password è troppo corta. Lunghezza minima: ${minLength} caratteri.`;
  }
  if (KnownErrors.PasswordTooLong.isInstance(error)) {
    const maxLength = error.constructorArgs[0];
    return `La password è troppo lunga. Lunghezza massima: ${maxLength} caratteri.`;
  }
  return error.humanReadableMessage || "La password non soddisfa i requisiti richiesti.";
}

function PasswordField({
  id,
  label,
  name,
  value,
  onChange,
  autoComplete,
  error,
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
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
          value={value}
          onChange={(event) => onChange(event.target.value)}
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

export function ProfilePasswordForm() {
  const user = useUser({ or: "return-null" });
  const stackApp = useStackApp();
  const project = stackApp.useProject();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordRepeat, setNewPasswordRepeat] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  if (!user || !project.config.credentialEnabled) {
    return null;
  }

  const hasPassword = user.hasPassword;
  const title = hasPassword ? "Password" : "Imposta password";
  const description = hasPassword
    ? "Aggiorna la password del tuo account."
    : "Imposta una password per accedere con email e password.";

  const resetForm = () => {
    setOldPassword("");
    setNewPassword("");
    setNewPasswordRepeat("");
    setFieldErrors({});
  };

  const validate = () => {
    const errors: FieldErrors = {};

    if (hasPassword && !oldPassword.trim()) {
      errors.oldPassword = "Inserisci la password attuale.";
    }

    if (!newPassword.trim()) {
      errors.newPassword = "Inserisci la nuova password.";
    } else {
      const passwordError = getPasswordError(newPassword);
      if (passwordError) {
        errors.newPassword = formatPasswordError(passwordError);
      }
    }

    if (!newPasswordRepeat.trim()) {
      errors.newPasswordRepeat = "Ripeti la nuova password.";
    } else if (newPasswordRepeat !== newPassword) {
      errors.newPasswordRepeat = "Le password non coincidono.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccessMessage(null);

    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      const result = hasPassword
        ? await user.updatePassword({ oldPassword, newPassword })
        : await user.setPassword({ password: newPassword });

      if (result) {
        if (KnownErrors.PasswordConfirmationMismatch.isInstance(result)) {
          setFieldErrors({ oldPassword: formatPasswordError(result) });
        } else {
          setFieldErrors({ newPassword: formatPasswordError(result) });
        }
        return;
      }

      resetForm();
      setIsEditing(false);
      setSuccessMessage(hasPassword ? "Password aggiornata con successo." : "Password impostata con successo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{description}</p>

      {successMessage ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
          {successMessage}
        </p>
      ) : null}

      {!isEditing ? (
        <button
          type="button"
          onClick={() => {
            setSuccessMessage(null);
            setIsEditing(true);
          }}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-full border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-emerald-700 dark:hover:text-emerald-300"
        >
          {hasPassword ? "Cambia password" : "Imposta password"}
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {hasPassword ? (
            <PasswordField
              id="old-password"
              label="Password attuale"
              name="oldPassword"
              value={oldPassword}
              onChange={setOldPassword}
              autoComplete="current-password"
              error={fieldErrors.oldPassword}
            />
          ) : null}

          <PasswordField
            id="new-password"
            label="Nuova password"
            name="newPassword"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            error={fieldErrors.newPassword}
          />

          <PasswordField
            id="new-password-repeat"
            label="Conferma nuova password"
            name="newPasswordRepeat"
            value={newPasswordRepeat}
            onChange={setNewPasswordRepeat}
            autoComplete="new-password"
            error={fieldErrors.newPasswordRepeat}
          />

          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Salvataggio..." : hasPassword ? "Aggiorna password" : "Imposta password"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                resetForm();
                setIsEditing(false);
              }}
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