"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { emitToast } from "@/components/global-toasts";
import { useRef } from "react";

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
  const handledRef = useRef<string>(""); 

  useEffect(() => {
    const active = messages.filter((msg) => msg.message);
    if (active.length === 0) return;

    const signature = active.map((msg) => `${msg.key}:${msg.message}`).join("|");
    if (handledRef.current === signature) return;
    handledRef.current = signature;
    active.forEach((msg) => emitToast(msg.message, msg.variant ?? "success"));

    const nextParams = new URLSearchParams(searchParams?.toString());
    active.forEach((msg) => nextParams.delete(msg.key));
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }, [messages, pathname, router, searchParams]);

  return null;
}
