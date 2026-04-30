# Resolve Final Lint Errors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the last 6 "unexpected any" lint errors by introducing proper TypeScript interfaces, Prisma payload types, and type guards.

**Architecture:** Use Prisma's generated types (e.g., `UserGetPayload`) for complex data structures and standard TypeScript features (e.g., `Partial`, `Record`, `unknown`) for simpler cases.

**Tech Stack:** TypeScript, Prisma, React.

---

### Task 1: Fix PaymentHistory `any[]`

**Files:**
- Modify: `src/components/payment-history.tsx`

- [ ] **Step 1: Define HistoricalPayment type**
  Replace `any[]` with a structured type based on usage in the component.
  
  ```typescript
  // src/components/payment-history.tsx
  
  type HistoricalPayment = {
    id: string;
    paidAt: Date;
    amount: number;
    method: PatientPaymentMethod;
    note: string | null;
    quoteItem?: {
      serviceName: string;
      tooth: number | null;
    } | null;
    user?: {
      name: string | null;
      email: string | null;
    } | null;
  };

  type PaymentHistoryProps = {
    historicalPayments: HistoricalPayment[];
    // ... rest
  };
  ```

- [ ] **Step 2: Run lint to verify**
  Run: `npm run lint`
  Expected: Error in `payment-history.tsx` is gone.

- [ ] **Step 3: Commit**
  ```bash
  git add src/components/payment-history.tsx
  git commit -m "fix(lint): replace any with HistoricalPayment type in PaymentHistory"
  ```

---

### Task 2: Fix QuoteItemRow `onUpdate` parameter

**Files:**
- Modify: `src/components/quote/QuoteItemRow.tsx`

- [ ] **Step 1: Update onUpdate signature**
  Use `Partial` of the item type for the `next` parameter.

  ```typescript
  // src/components/quote/QuoteItemRow.tsx
  
  onUpdate: (index: number, next: Partial<QuoteItemRowProps['item']>) => void;
  ```

- [ ] **Step 2: Run lint to verify**
  Run: `npm run lint`
  Expected: Error in `QuoteItemRow.tsx` is gone.

- [ ] **Step 3: Commit**
  ```bash
  git add src/components/quote/QuoteItemRow.tsx
  git commit -m "fix(lint): use Partial type for onUpdate in QuoteItemRow"
  ```

---

### Task 3: Fix Button component cast

**Files:**
- Modify: `src/components/ui/button.tsx`

- [ ] **Step 1: Remove unnecessary cast**
  `props.type` is already typed correctly from `ButtonHTMLAttributes`.

  ```typescript
  // src/components/ui/button.tsx
  
  type={props.type || "button"}
  ```

- [ ] **Step 2: Run lint to verify**
  Run: `npm run lint`
  Expected: Error in `button.tsx` is gone.

- [ ] **Step 3: Commit**
  ```bash
  git add src/components/ui/button.tsx
  git commit -m "fix(lint): remove unnecessary any cast in Button component"
  ```

---

### Task 4: Fix daily-reminder.ts helper types

**Files:**
- Modify: `src/lib/daily-reminder.ts`

- [ ] **Step 1: Import Prisma namespace and define helper types**
  Use `Prisma.UserGetPayload` and `Prisma.AppointmentGetPayload` to type the helper function.

  ```typescript
  // src/lib/daily-reminder.ts
  
  type UserWithDoctor = Prisma.UserGetPayload<{ include: { doctor: true } }>;
  type AppointmentWithPatient = Prisma.AppointmentGetPayload<{ include: { patient: true } }>;

  export function generateDailyReminderContent(
    user: UserWithDoctor, 
    appointments: AppointmentWithPatient[], 
    date: Date, 
    timeZone: string
  ) {
    // ...
  }
  ```

- [ ] **Step 2: Run lint to verify**
  Run: `npm run lint`
  Expected: Errors in `daily-reminder.ts` are gone.

- [ ] **Step 3: Commit**
  ```bash
  git add src/lib/daily-reminder.ts
  git commit -m "fix(lint): use Prisma payload types in daily-reminder.ts"
  ```

---

### Task 5: Fix practice-weekly-report.ts metadata access

**Files:**
- Modify: `src/lib/practice-weekly-report.ts`

- [ ] **Step 1: Add type guard for metadata access**
  Safely access `patientId` from the JSON metadata.

  ```typescript
  // src/lib/practice-weekly-report.ts
  
  .map((log) => {
    const metadata = log.metadata;
    if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
      const m = metadata as Record<string, unknown>;
      return m.patientId as string | undefined;
    }
    return undefined;
  })
  ```

- [ ] **Step 2: Run lint to verify**
  Run: `npm run lint`
  Expected: All errors are gone.

- [ ] **Step 3: Commit**
  ```bash
  git add src/lib/practice-weekly-report.ts
  git commit -m "fix(lint): safe metadata access in practice-weekly-report.ts"
  ```

---

### Task 6: Final Verification

- [ ] **Step 1: Run full lint check**
  Run: `npm run lint`
  Expected: 0 errors.
