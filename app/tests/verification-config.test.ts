import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appRoot = resolve(__dirname, "..");
const repoRoot = resolve(appRoot, "..");

describe("verification configuration", () => {
  it("exposes one local command that runs production build, tests, and lint", () => {
    const packageJson = JSON.parse(readFileSync(resolve(appRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.verify).toBe("npm run build && npm test && npm run lint");
  });

  it("runs the same verification on pushes to main and pull requests", () => {
    const workflow = readFileSync(resolve(repoRoot, ".github/workflows/ci.yml"), "utf8");

    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("push:");
    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npm run build");
    expect(workflow).toContain("npm test");
    expect(workflow).toContain("npm run lint");
    expect(workflow).toContain("DATABASE_URL:");
    expect(workflow).toContain("NEXT_PUBLIC_STACK_PROJECT_ID:");
    expect(workflow).toContain("STACK_SECRET_SERVER_KEY:");
  });

  it("includes high-risk patient pages in coverage accounting", () => {
    const config = readFileSync(resolve(appRoot, "vitest.config.ts"), "utf8");

    expect(config).toContain("src/app/**/pazienti/lista/page.tsx");
    expect(config).toContain("src/app/**/pazienti/\\\\[id\\\\]/page.tsx");
    expect(config).toContain("src/app/**/pazienti/duplicati/page.tsx");
  });
});
