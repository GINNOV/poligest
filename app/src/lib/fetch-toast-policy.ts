import { isIgnoredFetchFailure } from "@/lib/fetch-error-filter";

type FetchToastDecisionInput = {
  requestUrl: string;
  status: number;
  responseOk: boolean;
  shouldNotify: boolean;
};

export function shouldEmitFetchErrorToast({
  requestUrl,
  status,
  responseOk,
  shouldNotify,
}: FetchToastDecisionInput) {
  if (!shouldNotify || responseOk) return false;
  if (status >= 300 && status < 400) return false;
  return !isIgnoredFetchFailure(requestUrl, status);
}