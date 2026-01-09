"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { emitToast } from "@/components/global-toasts";

type ToastMessage = {
  key: string;
  message: string;
  variant?: "success" | "error" | "info";
};

type Props = {
  messages: ToastMessage[];
};

export function PageToastTrigger({ messages }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const active = messages.filter((msg) => msg.message);
    if (active.length === 0) return;

    active.forEach((msg) => emitToast(msg.message, msg.variant ?? "success"));

    const nextParams = new URLSearchParams(searchParams?.toString());
    active.forEach((msg) => nextParams.delete(msg.key));
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }, [messages, pathname, router, searchParams]);

  return null;
}
