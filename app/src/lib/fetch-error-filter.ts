const STACK_ANALYTICS_BATCH_PATHS = [
  "/api/stack/api/v1/analytics/events/batch",
  "/api/stack/v1/analytics/events/batch",
];

export function getFetchRequestPath(requestUrl: string) {
  if (!requestUrl) return "";

  try {
    return new URL(requestUrl, "https://placeholder.local").pathname;
  } catch {
    return requestUrl;
  }
}

export function isIgnoredFetchFailure(requestUrl: string, status: number) {
  if (status !== 429) return false;

  const path = getFetchRequestPath(requestUrl);
  return STACK_ANALYTICS_BATCH_PATHS.includes(path);
}
