"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HOME_SCREEN_STORAGE_KEY } from "@/lib/app-preferences";

const HOME_SCREEN_OPTIONS = ["/dashboard", "/agenda", "/pazienti", "/finanza", "/magazzino"] as const;

export function AppStartRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/dashboard") return;
    if (typeof window === "undefined") return;
    const hasRedirected = window.sessionStorage.getItem("poligest:home-redirected");
    if (hasRedirected) return;
    const preference = window.localStorage.getItem(HOME_SCREEN_STORAGE_KEY) ?? "";
    const normalized = HOME_SCREEN_OPTIONS.includes(preference as (typeof HOME_SCREEN_OPTIONS)[number])
      ? preference
      : "";
    if (!normalized || normalized === pathname) return;
    window.sessionStorage.setItem("poligest:home-redirected", "true");
    router.replace(normalized);
  }, [pathname, router]);

  return null;
}
