"use server";

import { KnownErrors } from "@stackframe/stack-shared";
import { getPasswordError } from "@stackframe/stack-shared/dist/helpers/password";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getStackServerApp } from "@/lib/stack-app";

export type ProfilePasswordFormState = {
  success?: boolean;
  error?: string;
  fieldErrors?: {
    oldPassword?: string;
    newPassword?: string;
    newPasswordRepeat?: string;
  };
};

function formatPasswordError(
  error: KnownErrors["PasswordRequirementsNotMet"] | KnownErrors["PasswordConfirmationMismatch"],
) {
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

export async function updateProfilePassword(
  _prevState: ProfilePasswordFormState,
  formData: FormData,
): Promise<ProfilePasswordFormState> {
  const user = await requireUser();
  const stackServerApp = getStackServerApp();
  const stackUser = await stackServerApp.getUser();

  if (!stackUser) {
    return { error: "Sessione non valida. Accedi di nuovo e riprova." };
  }

  const oldPassword = (formData.get("oldPassword") as string) ?? "";
  const newPassword = (formData.get("newPassword") as string) ?? "";
  const newPasswordRepeat = (formData.get("newPasswordRepeat") as string) ?? "";
  const fieldErrors: NonNullable<ProfilePasswordFormState["fieldErrors"]> = {};

  if (stackUser.hasPassword && !oldPassword.trim()) {
    fieldErrors.oldPassword = "Inserisci la password attuale.";
  }

  if (!newPassword.trim()) {
    fieldErrors.newPassword = "Inserisci la nuova password.";
  } else {
    const passwordError = getPasswordError(newPassword);
    if (passwordError) {
      fieldErrors.newPassword = formatPasswordError(passwordError);
    }
  }

  if (!newPasswordRepeat.trim()) {
    fieldErrors.newPasswordRepeat = "Ripeti la nuova password.";
  } else if (newPasswordRepeat !== newPassword) {
    fieldErrors.newPasswordRepeat = "Le password non coincidono.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  try {
    const result = stackUser.hasPassword
      ? await stackUser.updatePassword({ oldPassword, newPassword })
      : await stackUser.setPassword({ password: newPassword });

    if (result) {
      if (KnownErrors.PasswordConfirmationMismatch.isInstance(result)) {
        return { fieldErrors: { oldPassword: formatPasswordError(result) } };
      }
      return { fieldErrors: { newPassword: formatPasswordError(result) } };
    }
  } catch (error) {
    const message =
      error && typeof error === "object"
        ? (error as { humanReadableMessage?: string; message?: string }).humanReadableMessage ??
          (error as { message?: string }).message
        : null;
    return { error: message?.trim() || "Impossibile aggiornare la password. Riprova." };
  }

  await logAudit(user, {
    action: "profile.password_updated",
    entity: "User",
    entityId: user.id,
    metadata: { hadPassword: stackUser.hasPassword },
  });

  revalidatePath("/profilo");
  return { success: true };
}