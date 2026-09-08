export type StackPasswordResetUser = {
  readonly id: string;
  readonly primaryEmail?: string | null;
  readonly primaryEmailVerified: boolean;
  update(options: { readonly primaryEmailVerified: boolean }): Promise<void>;
};

export type StackPasswordResetApp = {
  readonly urls?: {
    readonly passwordReset?: string;
  };
  listUsers(options: {
    readonly query?: string;
    readonly limit?: number;
    readonly includeRestricted?: boolean;
    readonly includeAnonymous?: boolean;
  }): Promise<ReadonlyArray<StackPasswordResetUser>>;
  createUser(options: {
    readonly primaryEmail: string;
    readonly primaryEmailVerified: boolean;
    readonly displayName: string;
  }): Promise<StackPasswordResetUser>;
};

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
  return users.find((user) => user.primaryEmail?.toLowerCase() === email) ?? null;
}

export async function ensureStackUserCanReceivePasswordReset(
  stackServerApp: StackPasswordResetApp,
  email: string,
  displayName?: string | null,
) {
  const normalizedEmail = email.trim().toLowerCase();
  const queriedUsers = await stackServerApp.listUsers({
    query: normalizedEmail,
    limit: 50,
    includeRestricted: true,
    includeAnonymous: true,
  });
  const fallbackUsers = findUserByEmail(queriedUsers, normalizedEmail)
    ? []
    : await stackServerApp.listUsers({
        limit: 100,
        includeRestricted: true,
        includeAnonymous: true,
      });
  const existingUser =
    findUserByEmail(queriedUsers, normalizedEmail) ??
    findUserByEmail(fallbackUsers, normalizedEmail);
  const stackUser =
    existingUser ??
    await stackServerApp.createUser({
      primaryEmail: normalizedEmail,
      primaryEmailVerified: true,
      displayName: displayName ?? normalizedEmail.split("@")[0],
    });

  if (!stackUser.primaryEmailVerified) {
    await stackUser.update({ primaryEmailVerified: true });
  }

  return stackUser;
}
