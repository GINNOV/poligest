import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
}));

import MagazzinoPage from "./page";

function collectText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(collectText).join(" ");
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return collectText(node.props.children);
  }

  return "";
}

function collectHrefs(node: React.ReactNode): string[] {
  if (Array.isArray(node)) {
    return node.flatMap(collectHrefs);
  }

  if (React.isValidElement<{ href?: string; children?: React.ReactNode }>(node)) {
    return [
      ...(typeof node.props.href === "string" ? [node.props.href] : []),
      ...collectHrefs(node.props.children),
    ];
  }

  return [];
}

describe("MagazzinoPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "staff-1", role: Role.ADMIN });
  });

  it("renders separate product and implant destinations without embedded lists", async () => {
    const page = await MagazzinoPage();
    const text = collectText(page);
    const hrefs = collectHrefs(page);

    expect(hrefs).toEqual(expect.arrayContaining(["/magazzino/prodotti", "/magazzino/impianti"]));
    expect(text).toContain("Gestione prodotti");
    expect(text).toContain("Gestione impianti");
    expect(text).not.toContain("Lista prodotti");
    expect(text).not.toContain("Lista movimenti");
  });
});
