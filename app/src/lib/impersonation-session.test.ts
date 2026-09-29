import { describe, expect, it } from "vitest";
import {
  beginImpersonationSession,
  endImpersonationSession,
  type SessionCookie,
  type SessionCookieOptions,
  type SessionCookieStore,
} from "@/lib/impersonation-session";

class MemoryCookies implements SessionCookieStore {
  private readonly cookies = new Map<string, string>();

  get(name: string) {
    const value = this.cookies.get(name);
    return value === undefined ? undefined : { value };
  }

  getAll(): SessionCookie[] {
    return [...this.cookies.entries()].map(([name, value]) => ({ name, value }));
  }

  set(name: string, value: string, _options: SessionCookieOptions) {
    this.cookies.set(name, value);
  }

  delete(name: string) {
    this.cookies.delete(name);
  }
}

const projectId = "project-1";
const adminRefreshCookie = `stack-refresh-${projectId}--default`;
const adminRefreshValue = JSON.stringify({
  refresh_token: "admin-refresh",
  updated_at_millis: 10,
});
const adminAccessValue = JSON.stringify(["admin-refresh", "admin-access"]);

function seedAdminSession(store: MemoryCookies) {
  store.set(adminRefreshCookie, adminRefreshValue, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 60,
  });
  store.set("stack-access", adminAccessValue, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 60,
  });
  store.set("impersonateUserId", "user-target", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 60,
  });
}

describe("impersonation session cookies", () => {
  it("restores the admin session after Stack rewrites the impersonated cookies", () => {
    const store = new MemoryCookies();
    seedAdminSession(store);

    beginImpersonationSession(store, {
      projectId,
      refreshToken: "target-refresh",
      accessToken: "target-access",
      secure: true,
    });

    expect(store.get(adminRefreshCookie)?.value).toContain("target-refresh");
    expect(store.get("stack-access")?.value).toContain("target-access");

    store.delete(`stack-refresh-${projectId}`);
    store.set(`__Host-stack-refresh-${projectId}--default`, JSON.stringify({
      refresh_token: "target-refresh",
      updated_at_millis: Date.now(),
    }), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 60,
    });
    store.set("stack-access", JSON.stringify(["target-refresh", "target-access"]), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 60,
    });

    endImpersonationSession(store, { projectId, secure: true });

    expect(store.get(adminRefreshCookie)?.value).toBe(adminRefreshValue);
    expect(store.get("stack-access")?.value).toBe(adminAccessValue);
    expect(store.get(`__Host-stack-refresh-${projectId}--default`)).toBeUndefined();
    expect(store.get("impersonateUserId")).toBeUndefined();
    expect(store.getAll().some((cookie) => cookie.name.startsWith("impersonate-stack-"))).toBe(false);
  });

  it("restores a legacy refresh backup from older impersonation sessions", () => {
    const store = new MemoryCookies();
    store.set("impersonateUserId", "user-target", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 60,
    });
    store.set("impersonateAdminRefresh", "admin-refresh", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 60,
    });
    store.set(`__Host-stack-refresh-${projectId}--default`, JSON.stringify({
      refresh_token: "target-refresh",
      updated_at_millis: 20,
    }), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 60,
    });

    endImpersonationSession(store, { projectId, secure: false });

    expect(store.get(`stack-refresh-${projectId}`)?.value).toBe("admin-refresh");
    expect(store.get(`__Host-stack-refresh-${projectId}--default`)).toBeUndefined();
    expect(store.get("impersonateAdminRefresh")).toBeUndefined();
  });

  it("drops the impersonated stack session when the admin session was not saved", () => {
    const store = new MemoryCookies();
    store.set("impersonateUserId", "user-target", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 60,
    });
    store.set("stack-access", JSON.stringify(["target-refresh", "target-access"]), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 60,
    });

    endImpersonationSession(store, { projectId, secure: false });

    expect(store.get("stack-access")).toBeUndefined();
    expect(store.get("impersonateUserId")).toBeUndefined();
  });

  it("leaves a normal session alone when impersonation is not active", () => {
    const store = new MemoryCookies();
    store.set("stack-access", adminAccessValue, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 60,
    });

    endImpersonationSession(store, { projectId, secure: false });

    expect(store.get("stack-access")?.value).toBe(adminAccessValue);
  });
});
