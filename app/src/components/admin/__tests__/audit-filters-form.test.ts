import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const formPath = resolve(__dirname, "../audit-filters-form.tsx");

describe("audit filters form", () => {
  it("uses free-text search and role filter without a separate user picker", () => {
    const source = readFileSync(formPath, "utf8");

    expect(source).toContain('name="q"');
    expect(source).toContain('name="role"');
    expect(source).not.toContain('name="userId"');
    expect(source).not.toContain("datalist");
  });
});