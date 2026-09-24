import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { rewriteDemoSql } from "@/lib/demo/sql";
import { assertLiveClinicMutation, canImpersonateTarget } from "@/lib/demo/guard";
import { codiceFiscaleChecksum, demoCodiceFiscale } from "@/lib/demo/seed";

describe("demo clinic isolation", () => {
  it("rewrites live table names and leaves enum types alone", () => {
    const sql = 'SELECT "public"."User"."id" FROM "public"."User" WHERE "public"."User"."role" = CAST($1::text AS "public"."Role")';
    expect(rewriteDemoSql(sql, new Set(["User"]))).toBe(
      'SELECT "demo"."User"."id" FROM "demo"."User" WHERE "demo"."User"."role" = CAST($1::text AS "public"."Role")',
    );
  });

  it("refuses live maintenance from a demo session", () => {
    expect(() => assertLiveClinicMutation({ isDemo: true, realmIsDemo: false })).toThrow(/dimostrativo/);
    expect(() => assertLiveClinicMutation({ isDemo: false, realmIsDemo: true })).toThrow(/dimostrativo/);
    expect(() => assertLiveClinicMutation({ isDemo: false, realmIsDemo: false })).not.toThrow();
  });

  it("lets a demo admin impersonate only demo accounts", () => {
    expect(canImpersonateTarget({ role: Role.ADMIN, isDemo: true }, { isDemo: true })).toBe(true);
    expect(canImpersonateTarget({ role: Role.ADMIN, isDemo: true }, { isDemo: false })).toBe(false);
    expect(canImpersonateTarget({ role: Role.ADMIN, isDemo: false }, { isDemo: false })).toBe(true);
    expect(canImpersonateTarget({ role: Role.SECRETARY, isDemo: false }, { isDemo: true })).toBe(false);
  });

  it("builds a codice fiscale with a valid checksum", () => {
    expect(codiceFiscaleChecksum("RSSMRA80A01H501")).toBe("U");
    const fiscalCode = demoCodiceFiscale({
      lastName: "Conti",
      firstName: "Elena",
      year: 1985,
      month: 3,
      day: 12,
      female: true,
    });
    expect(fiscalCode).toHaveLength(16);
    expect(fiscalCode.at(-1)).toBe(codiceFiscaleChecksum(fiscalCode.slice(0, 15)));
  });
});
