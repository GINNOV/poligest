import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const fetchMock = vi.hoisted(() => vi.fn());

describe("POST /api/stack/[...stack]", () => {
  beforeEach(async () => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_STACK_PROJECT_ID", "test-project");
    vi.stubEnv("NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY", "test-publishable");
    vi.stubEnv("STACK_SECRET_SERVER_KEY", "test-secret");
    vi.resetModules();
  });

  async function postStack(
    request: NextRequest,
    stack: string[],
  ) {
    const { POST } = await import("./route");
    return POST(request, { params: Promise.resolve({ stack }) });
  }

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 204 when Stack analytics batch upstream fails", async () => {
    fetchMock.mockResolvedValue(
      new Response("upstream error", { status: 500, statusText: "Internal Server Error" }),
    );

    const request = new NextRequest(
      "http://localhost/api/stack/api/v1/analytics/events/batch",
      {
        method: "POST",
        body: JSON.stringify({ events: [] }),
        headers: { "content-type": "application/json" },
      },
    );

    const response = await postStack(request, ["api", "v1", "analytics", "events", "batch"]);

    expect(response.status).toBe(204);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.stack-auth.com/api/v1/analytics/events/batch",
    );
  });

  it("passes through successful Stack analytics batch responses", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const request = new NextRequest(
      "http://localhost/api/stack/api/v1/analytics/events/batch",
      {
        method: "POST",
        body: JSON.stringify({ events: [] }),
      },
    );

    const response = await postStack(request, ["api", "v1", "analytics", "events", "batch"]);

    expect(response.status).toBe(200);
  });

  it("passes through non-analytics upstream failures", async () => {
    fetchMock.mockResolvedValue(
      new Response("upstream error", { status: 500, statusText: "Internal Server Error" }),
    );

    const request = new NextRequest("http://localhost/api/stack/api/v1/auth/oauth/token", {
      method: "POST",
      body: JSON.stringify({ grant_type: "refresh_token" }),
    });

    const response = await postStack(request, ["api", "v1", "auth", "oauth", "token"]);

    expect(response.status).toBe(500);
  });
});