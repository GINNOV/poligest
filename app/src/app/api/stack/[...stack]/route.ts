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

async function proxyToStack(request: NextRequest, stackPath: string[]) {
  const normalizedPath =
    stackPath[0] === "v1" ? ["api", ...stackPath] : stackPath;
  const targetUrl = `${STACK_API_BASE}/${normalizedPath.join("/")}${request.nextUrl.search}`;

  const headers = new Headers(request.headers);
  headers.set("X-Stack-Project-Id", requireEnv("NEXT_PUBLIC_STACK_PROJECT_ID"));
  headers.set(
    "X-Stack-Publishable-Client-Key",
    requireEnv("NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY"),
  );
  headers.set("x-stack-secret-server-key", requireEnv("STACK_SECRET_SERVER_KEY"));
  headers.set("X-Stack-Access-Type", "server");
  headers.set("X-Stack-Client-Version", "custom-next-proxy");
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const response = await fetch(targetUrl, init);
  const responseHeaders = new Headers(response.headers);
  // Avoid double-decoding issues when the upstream is already compressed.
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
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
  context: { params: Promise<{ stack?: string[] }> } | { params: { stack?: string[] } },
) {
  const params = await context.params;
  return proxyToStack(req, params.stack ?? []);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ stack?: string[] }> } | { params: { stack?: string[] } },
) {
  const params = await context.params;
  return proxyToStack(req, params.stack ?? []);
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ stack?: string[] }> } | { params: { stack?: string[] } },
) {
  const params = await context.params;
  return proxyToStack(req, params.stack ?? []);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ stack?: string[] }> } | { params: { stack?: string[] } },
) {
  const params = await context.params;
  return proxyToStack(req, params.stack ?? []);
}
