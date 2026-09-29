export type SessionCookie = {
  name: string;
  value: string;
};

export type SessionCookieOptions = {
  path: string;
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  maxAge: number;
};

export type SessionCookieStore = {
  get(name: string): { value: string } | undefined;
  getAll(): SessionCookie[];
  set(name: string, value: string, options: SessionCookieOptions): void;
  delete(name: string): void;
};

const SIX_HOURS = 60 * 60 * 6;
const ONE_DAY = 60 * 60 * 24;
const ONE_YEAR = 60 * 60 * 24 * 365;
const BACKUP_NAME_PREFIX = "impersonate-stack-name-";
const BACKUP_VALUE_PREFIX = "impersonate-stack-value-";

export function isStackSessionCookie(name: string, projectId: string) {
  const refreshName = `stack-refresh-${projectId}`;
  return (
    name === "stack-access" ||
    name === `stack-access-${projectId}` ||
    name === "stack-refresh" ||
    name === refreshName ||
    name.startsWith(`${refreshName}--`) ||
    name.startsWith(`__Host-${refreshName}--`)
  );
}

function baseOptions(secure: boolean, maxAge: number): SessionCookieOptions {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge,
  };
}

function optionsForRestoredCookie(name: string, secure: boolean) {
  const hostPrefixed = name.startsWith("__Host-");
  const maxAge = name === "stack-access" || name.startsWith("stack-access-") ? ONE_DAY : ONE_YEAR;
  return baseOptions(hostPrefixed || secure, maxAge);
}

function clearNamedCookies(store: SessionCookieStore, names: string[]) {
  for (const name of names) {
    store.delete(name);
  }
}

function clearStackSessionCookies(store: SessionCookieStore, projectId: string) {
  clearNamedCookies(
    store,
    store
      .getAll()
      .map((cookie) => cookie.name)
      .filter((name) => isStackSessionCookie(name, projectId)),
  );
}

function isBackupCookie(name: string) {
  return (
    name.startsWith(BACKUP_NAME_PREFIX) ||
    name.startsWith(BACKUP_VALUE_PREFIX) ||
    name === "impersonateAdminAccess" ||
    name === "impersonateAdminRefresh"
  );
}

function clearBackupCookies(store: SessionCookieStore) {
  clearNamedCookies(
    store,
    store
      .getAll()
      .map((cookie) => cookie.name)
      .filter(isBackupCookie),
  );
}

function readIndexedBackups(store: SessionCookieStore) {
  const byIndex = new Map<number, { name?: string; value?: string }>();
  for (const cookie of store.getAll()) {
    const nameMatch = new RegExp(`^${BACKUP_NAME_PREFIX}(\\d+)$`).exec(cookie.name);
    const valueMatch = new RegExp(`^${BACKUP_VALUE_PREFIX}(\\d+)$`).exec(cookie.name);
    if (nameMatch) {
      const index = Number(nameMatch[1]);
      const entry = byIndex.get(index) ?? {};
      entry.name = cookie.value;
      byIndex.set(index, entry);
      continue;
    }
    if (valueMatch) {
      const index = Number(valueMatch[1]);
      const entry = byIndex.get(index) ?? {};
      entry.value = cookie.value;
      byIndex.set(index, entry);
    }
  }

  return [...byIndex.entries()]
    .sort(([left], [right]) => left - right)
    .flatMap(([, entry]) =>
      entry.name && entry.value !== undefined ? [{ name: entry.name, value: entry.value }] : [],
    );
}

function clearImpersonationFlags(store: SessionCookieStore) {
  store.delete("impersonateUserId");
  store.delete("impersonateAdminId");
}

// Stack reads `stack-access` plus `stack-refresh-<project>--default` (or the
// `__Host-` form). Its client rewrites those after impersonation starts, so the
// admin session has to be copied from the cookies Stack is actually using.
export function beginImpersonationSession(
  store: SessionCookieStore,
  input: { projectId: string; refreshToken: string; accessToken: string; secure: boolean },
) {
  const existing = store.getAll().filter((cookie) => isStackSessionCookie(cookie.name, input.projectId));
  clearStackSessionCookies(store, input.projectId);
  clearBackupCookies(store);

  existing.forEach((cookie, index) => {
    store.set(`${BACKUP_NAME_PREFIX}${index}`, cookie.name, baseOptions(input.secure, SIX_HOURS));
    store.set(`${BACKUP_VALUE_PREFIX}${index}`, cookie.value, baseOptions(input.secure, SIX_HOURS));
  });

  const refreshName = `stack-refresh-${input.projectId}`;
  store.set(refreshName, input.refreshToken, baseOptions(input.secure, SIX_HOURS));
  store.set(
    `${refreshName}--default`,
    JSON.stringify({ refresh_token: input.refreshToken, updated_at_millis: Date.now() }),
    baseOptions(input.secure, ONE_YEAR),
  );
  store.set(
    "stack-access",
    JSON.stringify([input.refreshToken, input.accessToken]),
    baseOptions(input.secure, ONE_DAY),
  );
}

export function endImpersonationSession(
  store: SessionCookieStore,
  input: { projectId: string; secure: boolean },
) {
  const backups = readIndexedBackups(store);
  const legacyRefresh = store.get("impersonateAdminRefresh")?.value;
  const impersonating = Boolean(store.get("impersonateUserId")?.value);

  if (backups.length > 0) {
    clearStackSessionCookies(store, input.projectId);
    clearBackupCookies(store);
    for (const cookie of backups) {
      store.set(cookie.name, cookie.value, optionsForRestoredCookie(cookie.name, input.secure));
    }
    clearImpersonationFlags(store);
    return;
  }

  if (legacyRefresh) {
    clearStackSessionCookies(store, input.projectId);
    clearBackupCookies(store);
    store.set(`stack-refresh-${input.projectId}`, legacyRefresh, baseOptions(input.secure, SIX_HOURS));
    clearImpersonationFlags(store);
    return;
  }

  if (impersonating) {
    clearStackSessionCookies(store, input.projectId);
    clearImpersonationFlags(store);
  }
}
