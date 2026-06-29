import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vitest/config";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(rootDir, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/.next/**"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      reportsDirectory: "coverage",
      all: true,
      include: [
        "src/lib/appointments/**/*.ts",
        "src/lib/calendar/**/*.ts",
        "src/lib/patients/**/*.ts",
        "src/lib/recalls/**/*.ts",
        "src/lib/recurring-messages/**/*.ts",
        "src/lib/crash-context.ts",
        "src/lib/date.ts",
        "src/lib/destructive-action-guard.ts",
        "src/lib/error-response.ts",
        "src/lib/infer-gender.ts",
        "src/lib/name.ts",
        "src/lib/patient-avatars.ts",
        "src/lib/phone.ts",
        "src/lib/practice-weekly-report.ts",
        "src/app/api/**/*.ts",
        "src/app/**/actions.ts",
        "src/app/**/pazienti/lista/page.tsx",
        "src/app/**/pazienti/\\[id\\]/page.tsx",
        "src/app/**/pazienti/duplicati/page.tsx",
        "src/app/**/magazzino/stock-movement-filters.ts",
        "src/app/**/magazzino/movimenti/page.tsx",
      ],
      exclude: [
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.test.tsx",
        "src/generated/**",
        "src/lib/**/__tests__/**",
        "src/components/**",
        "src/app/**/layout.tsx",
        "src/app/**/loading.tsx",
        "src/app/**/not-found.tsx",
        "src/app/**/error.tsx",
        "src/lib/prisma.ts",
        "src/lib/auth.ts",
        "src/lib/email.ts",
        "src/lib/sms.ts",
        "src/lib/stack-app.ts",
      ],
    },
  },
});
