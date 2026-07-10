import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "./proxy";

describe("proxy", () => {
  it("normalizes 127.0.0.1 to localhost in development", () => {
    const nextUrl = new URL("http://127.0.0.1:3000/richiami/programmati") as URL & { clone: () => URL };
    nextUrl.clone = () => new URL(nextUrl.href);

    const response = proxy({ nextUrl } as NextRequest);

    expect(response.headers.get("location")).toBe("http://localhost:3000/richiami/programmati");
  });

  it("rewrites unprefixed app routes to the internal locale route", () => {
    const response = proxy(new NextRequest("http://localhost:3000/richiami/programmati"));

    expect(response.headers.get("x-middleware-rewrite")).toBe("http://localhost:3000/it/richiami/programmati");
    expect(response.headers.get("location")).toBeNull();
  });

  it("lets already-prefixed locale routes continue without redirecting", () => {
    const response = proxy(new NextRequest("http://localhost:3000/it/richiami/programmati"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps health checks outside proxy matching", () => {
    expect(config.matcher).toEqual(["/((?!api|health|_next|_vercel|.*\\..*).*)"]);
  });
});
