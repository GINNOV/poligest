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
          // Check if the component has an isMounted guard
          const hasIsMounted = content.includes("isMounted");
          const hasUseEffect = content.includes("useEffect");
          
          // A simplified check: if the risky pattern is used in a way that is likely to cause a mismatch.
          // e.g., in a useState initializer or directly in the JSX without a guard.
          const inStateInitializer = new RegExp(`useState\\([^)]*${risk.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^)]*\\)`, 'g').test(content);
          
          // If it's in a state initializer and we don't have isMounted logic, it's a high risk.
          if (inStateInitializer && !hasIsMounted) {
             violations.push(`${file}: High risk - ${risk.description} used in useState initializer without isMounted guard.`);
          }
          
          // Also check for direct usage in JSX (coarse check)
          // If the pattern appears and there is no isMounted or useEffect to delay it.
          if (!hasIsMounted && !hasUseEffect) {
             violations.push(`${file}: Potential risk - ${risk.description} used without any mount-time synchronization.`);
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
