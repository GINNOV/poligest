export const APP_THEME_STORAGE_KEY = "app-theme-preference";
export const APP_THEME_EVENT = "app-theme-change";

export type ThemePreference = "system" | "light" | "dark";

export function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function getThemeInitScript() {
  return `
    (() => {
      const storageKey = ${JSON.stringify(APP_THEME_STORAGE_KEY)};
      const eventName = ${JSON.stringify(APP_THEME_EVENT)};
      const media = window.matchMedia('(prefers-color-scheme: dark)');

      const getPreference = () => {
        const stored = window.localStorage.getItem(storageKey);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          return stored;
        }
        return 'system';
      };

      const applyPreference = (preference) => {
        const resolved = preference === 'system'
          ? (media.matches ? 'dark' : 'light')
          : preference;
        const root = document.documentElement;
        root.classList.toggle('dark', resolved === 'dark');
        root.dataset.theme = preference;
        root.style.colorScheme = resolved;
      };

      const syncTheme = () => applyPreference(getPreference());
      syncTheme();

      media.addEventListener('change', () => {
        if (getPreference() === 'system') {
          syncTheme();
        }
      });

      window.addEventListener(eventName, syncTheme);
      window.__applyThemePreference = applyPreference;
    })();
  `;
}

declare global {
  interface Window {
    __applyThemePreference?: (preference: ThemePreference) => void;
  }
}
