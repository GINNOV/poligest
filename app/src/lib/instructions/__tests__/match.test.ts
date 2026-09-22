import { describe, it, expect } from "vitest";
import { Role } from "@prisma/client";
import {
  normalizePathname,
  normalizePathPattern,
  isValidPathPattern,
  pathMatchesPattern,
  roleMatches,
  pickBestInstruction,
  type InstructionMatchInput,
} from "../match";

describe("instructions / match", () => {
  describe("normalizePathname", () => {
    it("strips trailing slash except root", () => {
      expect(normalizePathname("/pazienti/")).toBe("/pazienti");
      expect(normalizePathname("/")).toBe("/");
      expect(normalizePathname("")).toBe("/");
    });

    it("strips the locale prefix added by the rewrite", () => {
      expect(normalizePathname("/it/pazienti/")).toBe("/pazienti");
      expect(normalizePathname("/it")).toBe("/");
    });

    it("strips query string and hash", () => {
      expect(normalizePathname("/pazienti?tab=active#details")).toBe("/pazienti");
      expect(normalizePathname("/agenda/day/2026-07-28?filter=all")).toBe(
        "/agenda/day/2026-07-28"
      );
    });
  });

  describe("normalizePathPattern", () => {
    it("converts regex wildcards and tidies slashes", () => {
      expect(normalizePathPattern("/pazienti/.*")).toBe("/pazienti/*");
      expect(normalizePathPattern(" /agenda//day/ ")).toBe("/agenda/day");
    });
  });

  describe("isValidPathPattern", () => {
    it("accepts valid route patterns", () => {
      expect(isValidPathPattern("/pazienti")).toBe(true);
      expect(isValidPathPattern("/pazienti/*")).toBe(true);
      expect(isValidPathPattern("/agenda/day/*")).toBe(true);
    });

    it("rejects invalid patterns", () => {
      expect(isValidPathPattern("pazienti")).toBe(false);
      expect(isValidPathPattern("/pazienti//list")).toBe(false);
      expect(isValidPathPattern("/pazienti/**")).toBe(false);
      expect(isValidPathPattern("/pazienti/ ")).toBe(false);
    });
  });

  describe("pathMatchesPattern", () => {
    it("matches exact paths", () => {
      expect(pathMatchesPattern("/pazienti", "/pazienti")).toBe(true);
      expect(pathMatchesPattern("/pazienti/new", "/pazienti")).toBe(false);
    });

    it("matches trailing wildcard (/*) for single and nested sub-segments", () => {
      expect(pathMatchesPattern("/pazienti/123", "/pazienti/*")).toBe(true);
      expect(pathMatchesPattern("/pazienti/123/edit", "/pazienti/*")).toBe(true);
    });

    it("does not treat bracket segments as wildcards", () => {
      expect(pathMatchesPattern("/pazienti/123", "/pazienti/[id]")).toBe(false);
    });

    it("matches a locale-prefixed pathname against a stored pattern", () => {
      expect(pathMatchesPattern("/it/pazienti/123", "/pazienti/*")).toBe(true);
    });
  });

  describe("roleMatches", () => {
    it("allows staff roles when instruction role is null", () => {
      expect(roleMatches(null, Role.ADMIN)).toBe(true);
      expect(roleMatches(null, Role.SECRETARY)).toBe(true);
      expect(roleMatches(null, Role.MANAGER)).toBe(true);
      expect(roleMatches(null, Role.ASSISTANT)).toBe(true);
    });

    it("restricts non-staff roles", () => {
      expect(roleMatches(null, Role.PATIENT)).toBe(false);
    });

    it("matches specific role requirements", () => {
      expect(roleMatches(Role.ADMIN, Role.ADMIN)).toBe(true);
      expect(roleMatches(Role.ADMIN, Role.SECRETARY)).toBe(false);
    });
  });

  describe("pickBestInstruction", () => {
    const mockDate = new Date("2026-07-28T10:00:00Z");
    const candidates: InstructionMatchInput[] = [
      {
        id: "1",
        pathPattern: "/pazienti/*",
        role: null,
        isActive: true,
        updatedAt: mockDate,
      },
      {
        id: "2",
        pathPattern: "/pazienti/123",
        role: null,
        isActive: true,
        updatedAt: mockDate,
      },
      {
        id: "3",
        pathPattern: "/pazienti/123",
        role: Role.SECRETARY,
        isActive: true,
        updatedAt: mockDate,
      },
      {
        id: "4",
        pathPattern: "/pazienti/123",
        role: null,
        isActive: false,
        updatedAt: mockDate,
      },
    ];

    it("prefers exact path match over wildcard", () => {
      const result = pickBestInstruction(candidates, "/pazienti/123", Role.ADMIN);
      expect(result?.id).toBe("2");
    });

    it("does not prefer a role-specific guide when rank is otherwise equal", () => {
      const result = pickBestInstruction(candidates, "/pazienti/123", Role.SECRETARY);
      expect(result?.id).toBe("2");
    });

    it("uses sortOrder as the tie-break after path specificity", () => {
      const ranked: InstructionMatchInput[] = [
        {
          id: "tutti",
          pathPattern: "/pazienti/123",
          role: null,
          isActive: true,
          updatedAt: mockDate,
          sortOrder: 0,
        },
        {
          id: "segreteria",
          pathPattern: "/pazienti/123",
          role: Role.SECRETARY,
          isActive: true,
          updatedAt: mockDate,
          sortOrder: 5,
        },
      ];
      expect(pickBestInstruction(ranked, "/pazienti/123", Role.SECRETARY)?.id).toBe(
        "segreteria",
      );
      expect(pickBestInstruction(ranked, "/pazienti/123", Role.ADMIN)?.id).toBe("tutti");
    });

    it("ignores inactive instructions", () => {
      const inactiveOnly: InstructionMatchInput[] = [
        {
          id: "4",
          pathPattern: "/pazienti/123",
          role: null,
          isActive: false,
          updatedAt: mockDate,
        },
      ];
      expect(pickBestInstruction(inactiveOnly, "/pazienti/123", Role.ADMIN)).toBeNull();
    });

    it("returns wildcard match when no exact match exists", () => {
      const result = pickBestInstruction(candidates, "/pazienti/999", Role.ADMIN);
      expect(result?.id).toBe("1");
    });
  });
});
