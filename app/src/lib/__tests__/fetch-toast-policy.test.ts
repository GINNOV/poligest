import { describe, expect, it } from "vitest";
import { shouldEmitFetchErrorToast } from "@/lib/fetch-toast-policy";

const analyticsUrl = "https://sorrisosplendente.com/api/stack/api/v1/analytics/events/batch";

describe("fetch toast policy", () => {
  it("does not toast Stack analytics batch failures after user interaction", () => {
    expect(
      shouldEmitFetchErrorToast({
        requestUrl: analyticsUrl,
        status: 500,
        responseOk: false,
        shouldNotify: true,
      }),
    ).toBe(false);

    expect(
      shouldEmitFetchErrorToast({
        requestUrl: analyticsUrl,
        status: 429,
        responseOk: false,
        shouldNotify: true,
      }),
    ).toBe(false);
  });

  it("still toasts real API failures after user interaction", () => {
    expect(
      shouldEmitFetchErrorToast({
        requestUrl: "/api/patients/check-duplicate",
        status: 500,
        responseOk: false,
        shouldNotify: true,
      }),
    ).toBe(true);
  });

  it("does not toast when there was no recent interaction", () => {
    expect(
      shouldEmitFetchErrorToast({
        requestUrl: "/api/patients/check-duplicate",
        status: 500,
        responseOk: false,
        shouldNotify: false,
      }),
    ).toBe(false);
  });

  it("does not toast successful or redirect responses", () => {
    expect(
      shouldEmitFetchErrorToast({
        requestUrl: "/api/patients",
        status: 200,
        responseOk: true,
        shouldNotify: true,
      }),
    ).toBe(false);

    expect(
      shouldEmitFetchErrorToast({
        requestUrl: "/api/patients",
        status: 302,
        responseOk: false,
        shouldNotify: true,
      }),
    ).toBe(false);
  });
});