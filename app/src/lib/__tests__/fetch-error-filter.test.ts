import { describe, expect, it } from "vitest";
import { isIgnoredFetchFailure } from "@/lib/fetch-error-filter";

describe("isIgnoredFetchFailure", () => {
  it("ignores Stack Auth analytics rate limit responses", () => {
    expect(
      isIgnoredFetchFailure(
        "https://sorrisosplendente.com/api/stack/api/v1/analytics/events/batch",
        429,
      ),
    ).toBe(true);
    expect(isIgnoredFetchFailure("/api/stack/v1/analytics/events/batch", 429)).toBe(true);
  });

  it("keeps other Stack Auth and app errors reportable", () => {
    expect(
      isIgnoredFetchFailure("https://sorrisosplendente.com/api/stack/api/v1/auth/oauth/token", 429),
    ).toBe(false);
    expect(isIgnoredFetchFailure("/api/pazienti", 500)).toBe(false);
  });
});
