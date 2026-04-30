# Zero Lint Errors & Warnings Refactoring Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reach ZERO lint errors and ZERO warnings across the entire codebase.

**Architecture:** Systematic resolution of TypeScript errors (`any` types), ESLint warnings (unused variables/imports), and React hook dependency issues.

**Tech Stack:** TypeScript, ESLint, React, Next.js, Vitest.

---

### Task 1: Fix `any` Errors in Tests

**Files:**
- Modify: `src/app/[locale]/(app)/calendar/actions.test.ts`
- Modify: `src/app/[locale]/(app)/finanza/actions.test.ts`

- [ ] **Step 1: Replace `err: any` with `err: unknown` in `calendar/actions.test.ts`**
- [ ] **Step 2: Narrow `err` to access `digest` or cast safely within the catch block**
- [ ] **Step 3: Fix other `any` usages in `calendar/actions.test.ts` (e.g., redirect digest)**
- [ ] **Step 4: Fix `txMock` and `any` in `finanza/actions.test.ts`**
- [ ] **Step 5: Run tests and lint for these files**

### Task 2: Fix `any` Errors in App & Components

**Files:**
- Modify: `src/app/[locale]/(app)/layout.tsx`
- Modify: `src/components/payment-registration-form.tsx`
- Modify: `src/components/quote/QuoteItemRow.tsx`
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/payment-history.tsx`

- [ ] **Step 1: Refactor `getOptionalPrismaModel` usage in `layout.tsx` to avoid `any`**
- [ ] **Step 2: Fix `useActionState` first argument in `payment-registration-form.tsx`**
- [ ] **Step 3: Define interface for `QuoteItemRow` update data**
- [ ] **Step 4: Fix `ref: any` in `button.tsx` using `React.ForwardedRef`**
- [ ] **Step 5: Fix `any` in `payment-history.tsx`**

### Task 3: Fix `any` Errors in Lib

**Files:**
- Modify: `src/lib/daily-reminder.ts`
- Modify: `src/lib/practice-weekly-report.ts`

- [ ] **Step 1: Replace `any` with specific Prisma types or interfaces in `daily-reminder.ts`**
- [ ] **Step 2: Fix `any` in `practice-weekly-report.ts`**

### Task 4: Remove Unused Variables & Imports

**Files:**
- Modify: 20+ files identified in `npm run lint` output

- [ ] **Step 1: Batch remove unused imports across all flagged files**
- [ ] **Step 2: Batch remove unused variables across all flagged files**
- [ ] **Step 3: Run `npm run lint` to verify progress**

### Task 5: Fix Missing Dependencies

**Files:**
- Modify: `src/components/quote/SignatureSection.tsx`

- [ ] **Step 1: Wrap `resizeCanvas` in `useCallback`**
- [ ] **Step 2: Add `resizeCanvas` and `getStrokeColor` to `useEffect` dependency array**

### Task 6: Final Verification

- [ ] **Step 1: Run `npm run lint` and verify 0 errors and 0 warnings**
- [ ] **Step 2: Run `npm test` and verify all tests pass**
- [ ] **Step 3: Commit all changes**
