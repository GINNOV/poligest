# Maintainability & Technical Debt Plan: Finanza/Pagamenti

This document outlines the strategic plan to resolve identified architectural friction and code debt in the financial management modules of Poligest. The goal is to reduce AI "thinking" time, minimize regressions, and improve developer velocity.

## 1. Domain Logic Consolidation
**Problem:** Financial math (totals, balances, payment statuses) is duplicated across `page.tsx`, `PaymentStateProvider.tsx`, and `actions.ts`.

### Strategy:
- Create `src/lib/finance/domain-logic.ts` as the "Single Source of Truth".
- Move all logic for `calculateRemaining()`, `determinePaymentStatus()`, and `summarizeQuote()` here.
- Ensure this library is pure TypeScript (no React hooks) so it can be used in both Server Components and Client Components.

## 2. Component Deconstruction (UI Refactoring)
**Problem:** `QuoteAccordion.tsx` (900+ lines) and `PagamentiPage` are too complex, handling data fetching, complex state, Wacom SDK integration, and rendering all at once.

### Strategy:
- **Modularize QuoteAccordion**: Extract sub-components:
    - `QuoteItemRow`: Handles individual row rendering and local input state.
    - `QuoteSignatureSection`: Encapsulates Wacom SDK logic.
    - `QuoteHeader`: Handles titles, printing, and summary badges.
- **Isolate State**: Move complex business logic out of the `useEffect` and `useMemo` blocks of the UI components and into specialized hooks or the shared domain library.

## 3. Action Modularization
**Problem:** `src/lib/patients/actions.ts` is a monolithic file (700+ lines) handling unrelated tasks.

### Strategy:
- Split into task-oriented files:
    - `src/lib/patients/actions/profile-actions.ts`: Photos, personal info, notes.
    - `src/lib/patients/actions/finance-actions.ts`: Quotes, payments, accounting sync.
    - `src/lib/patients/actions/anamnesis-actions.ts`: Medical history and conditions.

## 4. Data Schema Hardening (Removing String Matching)
**Problem:** Daily reports and audit logs rely on regex/string matching (e.g., `description.match(/Metodo: (.*)/)`) which is extremely brittle.

### Strategy:
- **Structured Logs**: Update the `FinanceEntry` and `AuditLog` models (or metadata field) to store machine-readable enum values for `paymentMethod`, `patientId`, and `doctorId`.
- **Typed Metadata**: Use a consistent JSON schema for the `metadata` field in `AuditLog` to allow for direct queries instead of parsing descriptions.

## 5. Synchronization Rule Hardening
**Problem:** The sync between the Clinical Diary and Accounting (`quote-sync.ts`) has unclear rules about when to overwrite vs. preserve manual changes.

### Strategy:
- **Explicit Ownership**: Add a flag to `QuoteItem` (e.g., `isManualAdjustment`) to explicitly track if a user has overridden the default cost.
- **Immutable Clinical Basis**: Ensure synchronization only affects the link to the diary, never overwriting a manual price unless the user explicitly clicks "Reset to Default".

---

## Success Metrics
- **AI Turn Efficiency**: Reduction in the number of tool calls needed for a typical UI change.
- **File Size**: No component or action file exceeds 300 lines.
- **Regression Rate**: Zero "reverted change" bugs after synchronization events.
- **Test Coverage**: High coverage for the pure logic in `src/lib/finance/domain-logic.ts`.
