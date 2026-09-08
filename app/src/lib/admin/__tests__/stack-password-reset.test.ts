import { describe, expect, it } from "vitest";
import {
  ensureStackUserCanReceivePasswordReset,
  resolvePasswordResetCallbackUrl,
  type StackPasswordResetApp,
  type StackPasswordResetUser,
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

  constructor(private readonly users: ReadonlyArray<StackPasswordResetUser>) {}

  async listUsers() {
    return this.users;
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

  it("uses the Stack password reset handler as callback URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://sorrisosplendente.com";
    const stackApp = new FakeStackApp([]);

    expect(resolvePasswordResetCallbackUrl(stackApp)).toBe(
      "https://sorrisosplendente.com/handler/password-reset",
    );
  });
});
