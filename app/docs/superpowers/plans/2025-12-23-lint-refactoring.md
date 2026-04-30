# Global Lint Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all 77 lint problems (28 errors, 49 warnings) in the project, adhering to Uncle Bob's engineering standards.

**Architecture:** Systematic cleanup of codebase using a Research -> Strategy -> Execution lifecycle. Fixes include type tightening, React hook correction, and dead code removal.

**Tech Stack:** TypeScript, React, Next.js, ESLint.

---

### Task 1: Fix `any` types (Errors)

**Files:**
- Modify: `src/app/[locale]/(app)/admin/audit/page.tsx`
- Modify: `src/app/[locale]/(app)/admin/promemoria-quotidiano/page.tsx`
- Modify: `src/app/[locale]/(app)/calendar/actions.test.ts`
- Modify: `src/app/[locale]/(app)/finanza/actions.test.ts`
- Modify: `src/app/[locale]/(app)/layout.tsx`
- Modify: `src/components/payment-history.tsx`
- Modify: `src/components/payment-registration-form.tsx`
- Modify: `src/components/quote/QuoteItemRow.tsx`
- Modify: `src/components/ui/button.tsx`
- Modify: `src/lib/daily-reminder.ts`
- Modify: `src/lib/practice-weekly-report.ts`

- [ ] **Step 1: Replace `any` with specific types or `unknown`**
  - Iterate through each file and identify the context of `any`.
  - Use existing interfaces or define new ones.
  - Use `unknown` with type guards if the type is truly dynamic.
- [ ] **Step 2: Verify changes**
  - Run `npm run lint` for these specific files.
- [ ] **Step 3: Commit**

### Task 2: Fix `setState` in `useEffect` (Errors)

**Files:**
- Modify: `src/components/dictation-textarea.tsx`
- Modify: `src/components/finance-forms.tsx`
- Modify: `src/components/help-button.tsx`
- Modify: `src/components/patient-anamnesis-notes.tsx`
- Modify: `src/components/patient-create-submit-button.tsx`

- [ ] **Step 1: Refactor cascading `setState` calls**
  - For `isSupported` or `mounted` checks, use initial state if possible (e.g., `useState(() => typeof window !== 'undefined' && ...)`).
  - For event listener syncing, ensure the update only happens if the value actually changed.
  - Move logic out of `useEffect` where it can be derived from props or other state.
- [ ] **Step 2: Verify changes**
  - Run `npm run lint` and ensure no cascading render warnings.
- [ ] **Step 3: Commit**

### Task 3: Remove unused variables and imports (Warnings)

**Files:**
- Numerous files across `src/app`, `src/components`, and `src/lib`.

- [ ] **Step 1: Batch remove unused items**
  - Use `npm run fix` (Biome) if available/configured, or manually remove them.
  - Ensure no functional code is removed.
- [ ] **Step 2: Verify changes**
  - Run `npm run lint`.
- [ ] **Step 3: Commit**

### Task 4: Fix React Hook Dependencies and remaining issues (Warnings)

**Files:**
- Modify: `src/components/quote/SignatureSection.tsx`
- Modify: `src/components/dental-chart.tsx` (unused vars/types)

- [ ] **Step 1: Correct missing dependencies in `useEffect`**
  - Add missing dependencies or use `useCallback`/`useMemo` to stabilize them.
- [ ] **Step 2: Final lint pass**
  - Run `npm run lint` to confirm 0 errors and 0 warnings.
- [ ] **Step 3: Commit**

---
Plan complete and saved to `docs/superpowers/plans/2025-12-23-lint-refactoring.md`.
