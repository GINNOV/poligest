"use client";

import { StackHandler, useStackApp } from "@stackframe/stack";
import { usePathname } from "next/navigation";
import { Suspense, useMemo } from "react";
import { StackSignInFlow } from "@/components/stack-sign-in-flow";

function normalizeAuthPath(path: string) {
  return path.toLowerCase().replace(/-/g, "");
}

function isSignInPath(path: string) {
  const normalized = normalizeAuthPath(path);
  return normalized === "signin" || normalized === "login";
}

function StackAuthHandlerContentInner({ isStaff }: { isStaff: boolean }) {
  const pathname = usePathname();
  const stackApp = useStackApp();

  const authPath = useMemo(() => {
    const handlerPath = new URL(stackApp.urls.handler, "http://example.com").pathname.replace(/\/$/, "");
    if (pathname.startsWith(handlerPath)) {
      return pathname.slice(handlerPath.length).replace(/^\/+/, "");
    }
    return pathname.replace(/^\/+/, "");
  }, [pathname, stackApp.urls.handler]);

  if (isSignInPath(authPath)) {
    return <StackSignInFlow isStaff={isStaff} />;
  }

  return <StackHandler fullPage={false} />;
}

export function StackAuthHandlerContent({ isStaff }: { isStaff: boolean }) {
  return (
    <Suspense
      fallback={
        <p className={isStaff ? "text-sm text-slate-400" : "text-sm text-zinc-500 dark:text-slate-400"}>
          Caricamento accesso...
        </p>
      }
    >
      <StackAuthHandlerContentInner isStaff={isStaff} />
    </Suspense>
  );
}