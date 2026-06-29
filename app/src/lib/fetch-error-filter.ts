const STACK_ANALYTICS_BATCH_PATHS = [
  "/api/stack/api/v1/analytics/events/batch",
  "/api/stack/v1/analytics/events/batch",
];

const STACK_OAUTH_TOKEN_PATHS = [
  "/api/stack/api/v1/auth/oauth/token",
  "/api/stack/v1/auth/oauth/token",
];

export function getFetchRequestPath(requestUrl: string) {
  if (!requestUrl) return "";

  try {
    return new URL(requestUrl, "https://placeholder.local").pathname;
  } catch {
    return requestUrl;
  }
}

export function resolveFetchRequestUrl(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (typeof input === "object" && input !== null) {
    if ("url" in input && typeof input.url === "string") return input.url;
    if ("href" in input && typeof input.href === "string") return input.href;
  }

  const request = init as RequestInit & { url?: string } | undefined;
  if (request?.url) return request.url;
  return "";
}

function isStackAnalyticsBatchPath(path: string) {
  return STACK_ANALYTICS_BATCH_PATHS.includes(path);
}

export function isIgnoredFetchFailure(requestUrl: string, status: number) {
  const path = getFetchRequestPath(requestUrl);

  // Stack Auth analytics is best-effort telemetry; never alarm staff on failures.
  if (isStackAnalyticsBatchPath(path)) {
    return true;
  }

  if (status !== 429) return false;

  return STACK_OAUTH_TOKEN_PATHS.includes(path);
}
