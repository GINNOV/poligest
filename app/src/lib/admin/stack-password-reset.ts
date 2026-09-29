import { KnownErrors } from "@stackframe/stack-shared";

export type StackPasswordResetUser = {
  readonly id: string;
  readonly primaryEmail?: string | null;
  readonly primaryEmailVerified: boolean;
  update(options: { readonly primaryEmailVerified: boolean }): Promise<void>;
};

export type StackUserPage = ReadonlyArray<StackPasswordResetUser> & {
  nextCursor?: string | null;
};

export type StackPasswordResetApp = {
  readonly urls?: {
    readonly passwordReset?: string;
  };
  listUsers(options: {
    readonly cursor?: string;
    readonly query?: string;
    readonly limit?: number;
    readonly includeRestricted?: boolean;
    readonly includeAnonymous?: boolean;
  }): Promise<StackUserPage>;
  createUser(options: {
    readonly primaryEmail: string;
    readonly primaryEmailVerified: boolean;
    readonly displayName: string;
  }): Promise<StackPasswordResetUser>;
};

export type StackAccessState = "verified" | "unverified" | "missing" | "unknown";

const MAX_USER_PAGES = 20;
const USER_PAGE_SIZE = 100;

export class StackAccessError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "StackAccessError";
    if (options && "cause" in options) {
      this.cause = options.cause;
    }
  }
}

function normalizeSiteOrigin(rawOrigin: string) {
  return /^https?:\/\//.test(rawOrigin)
    ? rawOrigin.replace(/\/$/, "")
    : `https://${rawOrigin.replace(/\/$/, "")}`;
}

export function resolvePasswordResetCallbackUrl(stackServerApp: StackPasswordResetApp) {
  const siteOrigin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!siteOrigin) {
    throw new Error("Callback URL mancante per il reset password.");
  }

  const passwordResetPath = stackServerApp.urls?.passwordReset ?? "/handler/password-reset";
  return new URL(passwordResetPath, normalizeSiteOrigin(siteOrigin)).toString();
}

function findUserByEmail(users: ReadonlyArray<StackPasswordResetUser>, email: string) {
  return users.find((user) => user.primaryEmail?.trim().toLowerCase() === email) ?? null;
}

function isDuplicateEmailError(error: unknown) {
  return (
    KnownErrors.UserWithEmailAlreadyExists.isInstance(error) ||
    (typeof error === "object" &&
      error !== null &&
      "errorCode" in error &&
      (error as { errorCode?: string }).errorCode === "USER_EMAIL_ALREADY_EXISTS")
  );
}

async function scanStackUsers(
  stackServerApp: StackPasswordResetApp,
  query?: string,
) {
  const users: StackPasswordResetUser[] = [];
  let cursor: string | undefined;
  let complete = false;

  for (let page = 0; page < MAX_USER_PAGES; page += 1) {
    const batch = await stackServerApp.listUsers({
      cursor,
      query,
      limit: USER_PAGE_SIZE,
      includeRestricted: true,
      includeAnonymous: true,
    });
    users.push(...batch);
    if (!batch.nextCursor) {
      complete = true;
      break;
    }
    cursor = batch.nextCursor;
  }

  return { users, complete };
}

async function findStackUser(stackServerApp: StackPasswordResetApp, email: string) {
  const queried = await scanStackUsers(stackServerApp, email);
  const directMatch = findUserByEmail(queried.users, email);
  if (directMatch) return directMatch;

  const everyone = await scanStackUsers(stackServerApp);
  return findUserByEmail(everyone.users, email);
}

async function markEmailVerified(stackUser: StackPasswordResetUser) {
  if (stackUser.primaryEmailVerified) return stackUser;
  await stackUser.update({ primaryEmailVerified: true });
  return stackUser;
}

export async function ensureVerifiedStackUser(
  stackServerApp: StackPasswordResetApp,
  email: string,
  displayName?: string | null,
) {
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await findStackUser(stackServerApp, normalizedEmail);
  if (existingUser) return markEmailVerified(existingUser);

  try {
    const created = await stackServerApp.createUser({
      primaryEmail: normalizedEmail,
      primaryEmailVerified: true,
      displayName: displayName?.trim() || normalizedEmail.split("@")[0],
    });
    return markEmailVerified(created);
  } catch (error) {
    if (!isDuplicateEmailError(error)) {
      throw new StackAccessError(`Impossibile preparare l'accesso per ${normalizedEmail}.`, { cause: error });
    }
    const recovered = await findStackUser(stackServerApp, normalizedEmail);
    if (!recovered) {
      throw new StackAccessError(
        `L'account ${normalizedEmail} esiste già ma l'email non è verificata, e non compare nell'elenco accessi. Segnala l'email come verificata dal pannello Stack.`,
        { cause: error },
      );
    }
    return markEmailVerified(recovered);
  }
}

export async function loadStackAccessByEmail(
  stackServerApp: StackPasswordResetApp,
  emails: readonly string[],
) {
  const wanted = new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean));
  const found = new Map<string, StackAccessState>();
  const { users, complete } = await scanStackUsers(stackServerApp);

  for (const user of users) {
    const email = user.primaryEmail?.trim().toLowerCase();
    if (!email || !wanted.has(email)) continue;
    found.set(email, user.primaryEmailVerified ? "verified" : "unverified");
  }

  for (const email of wanted) {
    if (!found.has(email)) found.set(email, complete ? "missing" : "unknown");
  }

  return found;
}

export function italianStackAccessMessage(email: string, error: unknown) {
  if (error instanceof StackAccessError) return error.message;
  const record = error && typeof error === "object" ? (error as { humanReadableMessage?: unknown; message?: unknown }) : null;
  const raw = typeof record?.humanReadableMessage === "string"
    ? record.humanReadableMessage
    : typeof record?.message === "string"
      ? record.message
      : "";
  if (/not verified|already exists/i.test(raw)) {
    return `L'email ${email} esiste già ma non è verificata. Usa «Sistema accesso» sulla scheda utente.`;
  }
  return raw.trim() || "Impossibile completare l'operazione sull'accesso. Riprova oppure usa «Sistema accesso» sulla scheda utente.";
}

export async function ensureStackUserCanReceivePasswordReset(
  stackServerApp: StackPasswordResetApp,
  email: string,
  displayName?: string | null,
) {
  return ensureVerifiedStackUser(stackServerApp, email, displayName);
}
