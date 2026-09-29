import { KnownErrors } from "@stackframe/stack-shared";
import { describe, expect, it } from "vitest";
import {
  ensureStackUserCanReceivePasswordReset,
  ensureVerifiedStackUser,
  loadStackAccessByEmail,
  resolvePasswordResetCallbackUrl,
  StackAccessError,
  type StackPasswordResetApp,
  type StackPasswordResetUser,
  type StackUserPage,
} from "@/lib/admin/stack-password-reset";

class FakeStackUser implements StackPasswordResetUser {
  public updateCount = 0;

  constructor(
    public readonly id: string,
    public readonly primaryEmail: string,
    public primaryEmailVerified: boolean,
  ) {}

  async update(options: { readonly primaryEmailVerified: boolean }) {
    this.primaryEmailVerified = options.primaryEmailVerified;
    this.updateCount += 1;
  }
}

class FakeStackApp implements StackPasswordResetApp {
  public createdUser: StackPasswordResetUser | null = null;
  public readonly urls = { passwordReset: "/handler/password-reset" };
  public users: StackPasswordResetUser[];

  constructor(users: ReadonlyArray<StackPasswordResetUser>) {
    this.users = [...users];
  }

  async listUsers(_options?: { query?: string }): Promise<StackUserPage> {
    return Object.assign([...this.users], { nextCursor: null });
  }

  async createUser(options: {
    readonly primaryEmail: string;
    readonly primaryEmailVerified: boolean;
    readonly displayName: string;
  }) {
    const user = new FakeStackUser("created-user", options.primaryEmail, options.primaryEmailVerified);
    this.createdUser = user;
    return user;
  }
}

describe("ensureStackUserCanReceivePasswordReset", () => {
  it("verifies an existing unverified Stack user before password reset", async () => {
    const user = new FakeStackUser("stack-user-1", "staff@example.com", false);
    const stackApp = new FakeStackApp([user]);

    const result = await ensureStackUserCanReceivePasswordReset(stackApp, " STAFF@example.com ");

    expect(result.id).toBe("stack-user-1");
    expect(user.primaryEmailVerified).toBe(true);
    expect(user.updateCount).toBe(1);
  });

  it("creates a verified Stack user when the database user is missing in Stack", async () => {
    const stackApp = new FakeStackApp([]);

    const result = await ensureStackUserCanReceivePasswordReset(
      stackApp,
      "new-staff@example.com",
      "New Staff",
    );

    expect(result.id).toBe("created-user");
    expect(result.primaryEmail).toBe("new-staff@example.com");
    expect(result.primaryEmailVerified).toBe(true);
    expect(stackApp.createdUser).toBe(result);
  });

  it("verifies an unverified account that a direct email search does not return", async () => {
    const user = new FakeStackUser(
      "stack-angela",
      "studio.agovino.angrisano+angela@gmail.com",
      false,
    );
    const stackApp = new FakeStackApp([user]);
    const originalList = stackApp.listUsers.bind(stackApp);
    stackApp.listUsers = async (options) => {
      if (options?.query?.includes("+")) return Object.assign([], { nextCursor: null });
      return originalList();
    };

    const result = await ensureVerifiedStackUser(
      stackApp,
      "studio.agovino.angrisano+angela@gmail.com",
      "Angela",
    );

    expect(result.id).toBe("stack-angela");
    expect(user.primaryEmailVerified).toBe(true);
    expect(stackApp.createdUser).toBeNull();
  });

  it("verifies the existing account when Stack rejects a second create", async () => {
    const user = new FakeStackUser("stack-angela", "angela@example.com", false);
    let scans = 0;
    const stackApp = new FakeStackApp([]);
    stackApp.listUsers = async () => {
      scans += 1;
      const visible = scans > 2 ? [user] : [];
      return Object.assign(visible, { nextCursor: null });
    };
    stackApp.createUser = async () => {
      throw new KnownErrors.UserWithEmailAlreadyExists("angela@example.com", true);
    };

    const result = await ensureVerifiedStackUser(stackApp, "angela@example.com");

    expect(result.id).toBe("stack-angela");
    expect(user.primaryEmailVerified).toBe(true);
  });

  it("reports a duplicate unverified account in Italian when the account cannot be listed", async () => {
    const stackApp = new FakeStackApp([]);
    stackApp.createUser = async () => {
      throw new KnownErrors.UserWithEmailAlreadyExists("angela@example.com", true);
    };

    await expect(ensureVerifiedStackUser(stackApp, "angela@example.com")).rejects.toThrow(StackAccessError);
    await expect(ensureVerifiedStackUser(stackApp, "angela@example.com")).rejects.toThrow(
      /email non è verificata/,
    );
  });

  it("tells the admin which listed emails are still unverified", async () => {
    const stackApp = new FakeStackApp([
      new FakeStackUser("verified", "verified@example.com", true),
      new FakeStackUser("unverified", "angela@example.com", false),
    ]);

    const access = await loadStackAccessByEmail(stackApp, [
      "angela@example.com",
      "verified@example.com",
      "missing@example.com",
    ]);

    expect(access.get("angela@example.com")).toBe("unverified");
    expect(access.get("verified@example.com")).toBe("verified");
    expect(access.get("missing@example.com")).toBe("missing");
  });

  it("uses the Stack password reset handler as callback URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://sorrisosplendente.com";
    const stackApp = new FakeStackApp([]);

    expect(resolvePasswordResetCallbackUrl(stackApp)).toBe(
      "https://sorrisosplendente.com/handler/password-reset",
    );
  });
});
