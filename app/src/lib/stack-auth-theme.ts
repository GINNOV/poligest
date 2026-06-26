type StackColors = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
};

type ThemeConfig = {
  light?: Partial<StackColors>;
  dark?: Partial<StackColors>;
  radius?: string;
};

const sharedLightForm: Partial<StackColors> = {
  background: "#ffffff",
  foreground: "#0f172a",
  card: "#ffffff",
  cardForeground: "#0f172a",
  popover: "#ffffff",
  popoverForeground: "#0f172a",
  secondary: "#f1f5f9",
  secondaryForeground: "#0f172a",
  muted: "#f8fafc",
  mutedForeground: "#64748b",
  accent: "#f1f5f9",
  accentForeground: "#0f172a",
  destructive: "#e11d48",
  destructiveForeground: "#ffffff",
  border: "#e2e8f0",
  input: "#e2e8f0",
};

export function getStackAuthTheme(isStaff: boolean): ThemeConfig {
  if (isStaff) {
    return {
      radius: "0.75rem",
      light: {
        ...sharedLightForm,
        primary: "#0891b2",
        primaryForeground: "#ffffff",
        ring: "#0891b2",
      },
      dark: {
        ...sharedLightForm,
        primary: "#0891b2",
        primaryForeground: "#ffffff",
        ring: "#0891b2",
      },
    };
  }

  return {
    radius: "0.75rem",
    light: {
      ...sharedLightForm,
      primary: "#047857",
      primaryForeground: "#ffffff",
      ring: "#059669",
    },
    dark: {
      background: "#09090b",
      foreground: "#fafafa",
      card: "#09090b",
      cardForeground: "#fafafa",
      popover: "#09090b",
      popoverForeground: "#fafafa",
      primary: "#10b981",
      primaryForeground: "#022c22",
      secondary: "#27272a",
      secondaryForeground: "#fafafa",
      muted: "#27272a",
      mutedForeground: "#a1a1aa",
      accent: "#27272a",
      accentForeground: "#fafafa",
      destructive: "#f43f5e",
      destructiveForeground: "#ffffff",
      border: "#3f3f46",
      input: "#3f3f46",
      ring: "#10b981",
    },
  };
}