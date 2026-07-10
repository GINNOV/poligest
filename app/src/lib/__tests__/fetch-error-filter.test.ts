import { describe, expect, it } from "vitest";
import {
  getFetchRequestPath,
  isIgnoredFetchFailure,
  resolveFetchRequestUrl,
} from "@/lib/fetch-error-filter";

describe("fetch error filter", () => {
  it("ignores Stack analytics batch failures", () => {
    expect(
      isIgnoredFetchFailure(
        "https://sorrisosplendente.com/api/stack/api/v1/analytics/events/batch",
        429,
      ),
    ).toBe(true);
    expect(
      isIgnoredFetchFailure(
        "https://sorrisosplendente.com/api/stack/api/v1/analytics/events/batch",
        500,
      ),
    ).toBe(true);
    expect(isIgnoredFetchFailure("/api/stack/v1/analytics/events/batch", 429)).toBe(true);
    expect(isIgnoredFetchFailure("/api/stack/v1/analytics/events/batch", 500)).toBe(true);
    expect(isIgnoredFetchFailure("/api/stack/v1/analytics/events/batch", 0)).toBe(true);
  });

  it("ignores known Stack oauth token rate limits", () => {
    expect(
      isIgnoredFetchFailure("https://sorrisosplendente.com/api/stack/api/v1/auth/oauth/token", 429),
    ).toBe(true);
    expect(isIgnoredFetchFailure("/api/stack/v1/auth/oauth/token", 429)).toBe(true);
  });

  it("ignores health check failures", () => {
    expect(isIgnoredFetchFailure("/health", 404)).toBe(true);
    expect(isIgnoredFetchFailure("https://sorrisosplendente.com/health", 404)).toBe(true);
    expect(isIgnoredFetchFailure("https://sorrisosplendente.com/health", 500)).toBe(false);
  });

  it("does not ignore unrelated failures", () => {
    expect(isIgnoredFetchFailure("/api/pazienti", 500)).toBe(false);
    expect(isIgnoredFetchFailure("/api/pazienti", 404)).toBe(false);
  });

  it("resolves fetch urls from strings, Request objects, and URL objects", () => {
    expect(resolveFetchRequestUrl("/api/patients")).toBe("/api/patients");
    expect(resolveFetchRequestUrl(new URL("https://example.com/api/patients"))).toBe(
      "https://example.com/api/patients",
    );
    expect(
      resolveFetchRequestUrl(new Request("https://example.com/api/patients/check-duplicate")),
    ).toBe("https://example.com/api/patients/check-duplicate");
    expect(getFetchRequestPath("https://example.com/api/patients/check-duplicate")).toBe(
      "/api/patients/check-duplicate",
    );
  });
});
