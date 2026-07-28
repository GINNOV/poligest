import type { Role } from "@prisma/client";

export type InstructionMatchInput = {
  id: string;
  pathPattern: string;
  role: Role | null;
  isActive: boolean;
  updatedAt: Date;
  sortOrder?: number;
};

const STAFF_ROLES: ReadonlySet<string> = new Set([
  "ADMIN",
  "MANAGER",
  "ASSISTANT",
  "SECRETARY",
]);

/** Normalize pathname: drop query/hash, strip trailing slash (except root). */
export function normalizePathname(pathname: string): string {
  const raw = pathname.split("?")[0]?.split("#")[0] ?? "";
  if (!raw || raw === "/") return "/";
  return raw.length > 1 && raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

/**
 * Normalize admin-entered path patterns before validate/store:
 * trim, strip trailing slash, collapse `//`, map dynamic bracket syntax `[id]` or regex `.*` to `*`.
 */
export function normalizePathPattern(pattern: string): string {
  let p = pattern.trim();
  // Map dynamic brackets like [id] or [param] -> *
  p = p.replace(/\[[^\]]+\]/g, "*");
  // Common paste from regex habits: .* -> *
  p = p.replace(/\.\*/g, "*");
  // Collapse duplicate slashes (keep leading)
  p = p.replace(/\/{2,}/g, "/");
  // Strip trailing slash (except root)
  if (p.length > 1 && p.endsWith("/")) {
    p = p.slice(0, -1);
  }
  return p;
}

/**
 * Path patterns must be valid paths (e.g. starting with `/`).
 * `*` = one path segment; a trailing `/*` matches one or more segments under the prefix.
 */
export function isValidPathPattern(pattern: string): boolean {
  const p = pattern;
  if (!p || p !== p.trim()) return false;
  if (!p.startsWith("/")) return false;
  if (/\s/.test(p)) return false;
  if (!/^\/[a-zA-Z0-9_\-/*]+$/.test(p)) return false;
  if (p.includes("**")) return false;
  if (p.includes("//")) return false;
  if (p.length > 1 && p.endsWith("/")) return false;
  // No empty segments
  if (p.split("/").some((seg, i) => i > 0 && seg === "")) return false;
  return true;
}

function escapeRegex(s: string): string {
  return s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a regex for a validated path pattern.
 * Trailing `/*` matches the prefix itself and any number of extra sub-segments.
 */
export function patternToRegex(pattern: string): RegExp {
  const p = pattern.trim();
  if (p.endsWith("/*")) {
    const prefix = p.slice(0, -2);
    const prefixSource = prefix
      .split("*")
      .map(escapeRegex)
      .join("[^/]+");
    return new RegExp(`^${prefixSource}(?:/[^/]+)*$`);
  }

  const source = p
    .split("*")
    .map(escapeRegex)
    .join("[^/]+");
  return new RegExp(`^${source}$`);
}

export function pathMatchesPattern(pathname: string, pattern: string): boolean {
  const path = normalizePathname(pathname);
  const p = normalizePathPattern(pattern);
  if (!isValidPathPattern(p)) return false;
  try {
    return patternToRegex(p).test(path);
  } catch {
    return false;
  }
}

export function roleMatches(
  instructionRole: Role | null | undefined,
  userRole: string
): boolean {
  if (!STAFF_ROLES.has(userRole)) return false;
  if (instructionRole == null) return true;
  return instructionRole === userRole;
}

function wildcardCount(pattern: string): number {
  return (pattern.match(/\*/g) ?? []).length;
}

function fixedLength(pattern: string): number {
  return pattern.replace(/\*/g, "").length;
}

/**
 * Rank candidates: fewer wildcards, longer fixed path, specific role over general, higher sortOrder, newer updatedAt.
 * Returns the best match or null.
 */
export function pickBestInstruction<T extends InstructionMatchInput>(
  candidates: T[],
  pathname: string,
  userRole: string
): T | null {
  const path = normalizePathname(pathname);
  const eligible = candidates.filter(
    (c) =>
      c.isActive &&
      roleMatches(c.role, userRole) &&
      pathMatchesPattern(path, c.pathPattern)
  );
  if (eligible.length === 0) return null;

  eligible.sort((a, b) => {
    const wa = wildcardCount(a.pathPattern);
    const wb = wildcardCount(b.pathPattern);
    if (wa !== wb) return wa - wb;
    const fa = fixedLength(a.pathPattern);
    const fb = fixedLength(b.pathPattern);
    if (fa !== fb) return fb - fa;
    const ra = a.role != null ? 1 : 0;
    const rb = b.role != null ? 1 : 0;
    if (ra !== rb) return rb - ra;
    const sa = a.sortOrder ?? 0;
    const sb = b.sortOrder ?? 0;
    if (sa !== sb) return sb - sa;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  return eligible[0] ?? null;
}
