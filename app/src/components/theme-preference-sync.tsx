"use client";

import { useEffect } from "react";
import { APP_THEME_EVENT, APP_THEME_STORAGE_KEY, isThemePreference, type ThemePreference } from "@/lib/theme";

function getStoredPreference(): ThemePreference {
  const stored = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
  return isThemePreference(stored) ? stored : "system";
}

function applyPreference(preference: ThemePreference) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = preference === "system" ? (prefersDark ? "dark" : "light") : preference;

  root.classList.toggle("dark", resolved === "dark");
  root.dataset.theme = preference;
  root.style.colorScheme = resolved;
}

export function ThemePreferenceSync() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => applyPreference(getStoredPreference());

    syncTheme();

    const handleMediaChange = () => {
      if (getStoredPreference() === "system") {
        syncTheme();
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === APP_THEME_STORAGE_KEY) {
        syncTheme();
      }
    };

    media.addEventListener("change", handleMediaChange);
    window.addEventListener(APP_THEME_EVENT, syncTheme);
    window.addEventListener("storage", handleStorage);

    return () => {
      media.removeEventListener("change", handleMediaChange);
      window.removeEventListener(APP_THEME_EVENT, syncTheme);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return null;
}
