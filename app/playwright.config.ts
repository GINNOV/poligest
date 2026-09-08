import { defineConfig, devices } from "@playwright/test";

const smokePort = Number.parseInt(process.env.E2E_SMOKE_PORT ?? "3100", 10);
const baseURL = `http://localhost:${smokePort}`;

export default defineConfig({
  testDir: "./tests/smoke",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `E2E_SMOKE_AUTH=1 npm run dev -- --hostname localhost --port ${smokePort}`,
    url: `${baseURL}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
