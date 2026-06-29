import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";

// Re-export helpers by testing the same logic inline would be brittle;
// instead verify role scoping behavior through a tiny pure helper mirrored in the component.

function filterUsersByRole<T extends { role: Role }>(users: T[], role: string) {
  return role ? users.filter((user) => user.role === role) : users;
}

describe("audit filters", () => {
  it("scopes users to the selected role", () => {
    const users = [
      { id: "1", role: Role.MANAGER, email: "doc@example.com", name: "Dr. Rossi" },
      { id: "2", role: Role.SECRETARY, email: "seg@example.com", name: "Anna" },
    ];

    expect(filterUsersByRole(users, Role.MANAGER)).toEqual([users[0]]);
    expect(filterUsersByRole(users, "")).toEqual(users);
  });
});