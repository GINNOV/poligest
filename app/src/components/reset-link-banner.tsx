"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  title: string;
  body: string;
  delayMs?: number;
};

export function ResetLinkBanner({ title, body, delayMs = 5000 }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamString = searchParams.toString();

  useEffect(() => {
    const params = new URLSearchParams(searchParamString);
    const hasResetParams = params.has("resetSent") || params.has("resetEmail");
    if (!hasResetParams) return;

    const timer = window.setTimeout(() => {
      params.delete("resetSent");
      params.delete("resetEmail");
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [delayMs, pathname, router, searchParamString]);

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm">
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-emerald-800">{body}</p>
    </div>
  );
}
