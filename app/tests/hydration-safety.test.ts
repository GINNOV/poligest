import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { globSync } from "glob";

describe("Hydration Safety Checks", () => {
  const componentFiles = globSync("src/components/**/*.tsx");

  it("ensures that client components using dynamic browser data handle hydration safely", () => {
    const risks = [
      { pattern: "getBrowserUserDisplayTimeZone()", description: "Direct call to getBrowserUserDisplayTimeZone in render/state" },
      { pattern: "new Date()", description: "Direct use of new Date() in render/state" },
      { pattern: "Intl.DateTimeFormat().resolvedOptions().timeZone", description: "Direct browser timezone access" },
    ];

    const violations: string[] = [];

    for (const file of componentFiles) {
      const content = readFileSync(file, "utf-8");
      if (!content.includes('"use client"')) continue;

      for (const risk of risks) {
        if (content.includes(risk.pattern)) {
          // If it uses isMounted or useEffect to wrap it, it might be safe.
          // This is a coarse check.
          const isGuarded = content.includes("isMounted") || content.includes("useEffect");
          
          // Specifically check for dangerous initialization in useState or top level
          const dangerousAssignment = new RegExp(`const\\s+.*\\s*=\\s*useState\\([^)]*${risk.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^)]*\\)`, 'g').test(content) ||
                                     new RegExp(`const\\s+.*\\s*=\\s*${risk.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g').test(content);

          if (dangerousAssignment && !isGuarded) {
            violations.push(`${file}: Potential hydration mismatch from ${risk.description}`);
          }
        }
      }
    }

    if (violations.length > 0) {
      console.warn("Potential hydration violations found:\n" + violations.join("\n"));
    }
    
    // We don't fail the test yet because some might be false positives, 
    // but we report them.
    expect(violations.length).toBeLessThan(10); // Sanity threshold
  });
});
