import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const rawStackApiUrl = process.env.NEXT_PUBLIC_STACK_API_URL || process.env.STACK_API_URL;
const STACK_API_BASE = (rawStackApiUrl && /^https?:\/\//.test(rawStackApiUrl)
  ? rawStackApiUrl
  : "https://api.stack-auth.com"
).replace(/\/$/, "");

function requireEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var ${key} for Stack Auth proxy`);
  }
  return value;
}

const HOP_BY_HOP_REQUEST_HEADERS = ["host", "connection", "content-length", "transfer-encoding"];

function isAnalyticsBatchRequest(method: string, normalizedPath: string[]) {
  return method === "POST" && normalizedPath.join("/") === "api/v1/analytics/events/batch";
}

function sanitizeProxyRequestHeaders(headers: Headers) {
  for (const key of HOP_BY_HOP_REQUEST_HEADERS) {
    headers.delete(key);
  }
}

function sanitizeProxyResponseHeaders(headers: Headers) {
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("transfer-encoding");
}

async function proxyToStack(request: NextRequest, stackPath: string[]) {
  const normalizedPath =
    stackPath[0] === "v1" ? ["api", ...stackPath] : stackPath;
  const targetUrl = `${STACK_API_BASE}/${normalizedPath.join("/")}${request.nextUrl.search}`;
  const analyticsBatch = isAnalyticsBatchRequest(request.method, normalizedPath);

  const headers = new Headers(request.headers);
  headers.set("X-Stack-Project-Id", requireEnv("NEXT_PUBLIC_STACK_PROJECT_ID"));
  headers.set(
    "X-Stack-Publishable-Client-Key",
    requireEnv("NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY"),
  );
  headers.set("x-stack-secret-server-key", requireEnv("STACK_SECRET_SERVER_KEY"));
  headers.set("X-Stack-Access-Type", "server");
  headers.set("X-Stack-Client-Version", "custom-next-proxy");
  sanitizeProxyRequestHeaders(headers);

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let response: Response;
  try {
    response = await fetch(targetUrl, init);
  } catch (error) {
    console.error("Stack Auth proxy fetch failed", { targetUrl, error });
    if (analyticsBatch) {
      return new NextResponse(null, { status: 204 });
    }
    return NextResponse.json({ error: "Stack Auth proxy unavailable" }, { status: 502 });
  }

  if (analyticsBatch && !response.ok) {
    return new NextResponse(null, { status: 204 });
  }

  const responseHeaders = new Headers(response.headers);
  sanitizeProxyResponseHeaders(responseHeaders);
  const nextResponse = new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === "function") {
    const setCookies = getSetCookie.call(response.headers);
    for (const value of setCookies) {
      nextResponse.headers.append("set-cookie", value);
    }
  } else {
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      nextResponse.headers.append("set-cookie", setCookie);
    }
  }
  return nextResponse;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ stack?: string[] }> },
) {
  const params = await context.params;
  return proxyToStack(req, params.stack ?? []);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ stack?: string[] }> },
) {
  const params = await context.params;
  return proxyToStack(req, params.stack ?? []);
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ stack?: string[] }> },
) {
  const params = await context.params;
  return proxyToStack(req, params.stack ?? []);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ stack?: string[] }> },
) {
  const params = await context.params;
  return proxyToStack(req, params.stack ?? []);
}
