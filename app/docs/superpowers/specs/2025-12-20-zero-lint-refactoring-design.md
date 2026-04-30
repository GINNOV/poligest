# Design: Zero Lint Errors & Warnings Refactoring

**Goal:** Achieve 100% green status in `npm run lint` and `npm test` by resolving all 18 errors and 47 warnings.

## 1. Addressing `any` Types

### 1.1 Tests (`catch (err: any)`)
- **Strategy:** Replace `err: any` with `err: unknown`.
- **Refinement:** Use type guards or type assertions (if safe in test context) to access properties like `digest`.
- **Target Files:**
    - `src/app/[locale]/(app)/calendar/actions.test.ts`
    - `src/app/[locale]/(app)/finanza/actions.test.ts`

### 1.2 Layout Clients (`getOptionalPrismaModel`)
- **Strategy:** Improve the generic type for `getOptionalPrismaModel`.
- **Refinement:** Use `unknown` for arguments and specific return types if possible, or `Record<string, unknown>`.
- **Target File:** `src/app/[locale]/(app)/layout.tsx`

### 1.3 Components & Forms
- **Strategy:** Identify the underlying data structure.
- **Refinement:**
    - `PaymentRegistrationForm`: Use the state type for the first argument of the action.
    - `QuoteItemRow`: Define an interface for the update data.
    - `button.tsx`: Use `React.ForwardedRef<HTMLButtonElement>`.
- **Target Files:**
    - `src/components/payment-registration-form.tsx`
    - `src/components/quote/QuoteItemRow.tsx`
    - `src/components/ui/button.tsx`

### 1.4 Library Logic
- **Strategy:** Narrow Prisma types.
- **Target Files:**
    - `src/lib/daily-reminder.ts`
    - `src/lib/practice-weekly-report.ts`

## 2. Removing Unused Variables, Imports, and Types

- **Strategy:** Systematically remove all flagged unused items.
- **Verification:** Ensure that removing an import doesn't break types that were implicitly using it (unlikely with ESLint's `no-unused-vars`).

## 3. Fixing Missing Dependencies

- **Strategy:** Add `resizeCanvas` to the `useEffect` dependency array in `SignatureSection.tsx`.
- **Verification:** Ensure `resizeCanvas` is stable (wrapped in `useCallback`) if it's defined in the component body.

## 4. Validation Workflow

1.  **Surgical Edit:** Apply changes to one file or a group of related files.
2.  **Lint Check:** Run `npx eslint <file_path>` to verify the fix.
3.  **Test Check:** Run `npm test` to ensure no regressions.
4.  **Batch Verification:** Periodically run `npm run lint` to track progress.

## 5. Success Criteria
- `npm run lint` returns 0 errors and 0 warnings.
- `npm test` passes all tests.
