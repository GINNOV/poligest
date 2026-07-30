# Patient Duplicate Merge (Phase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff merge empty-shell patient duplicates into a suggested keeper (one-click + bulk), and optionally auto-merge strong-match empty shells when a practice setting is enabled.

**Architecture:** Detection stays in `findPotentialPatientDuplicates`. New pure planning code classifies groups (safe / auto-eligible), ranks keepers with full attachment counts, and builds field-fill plans. A shared executor fills missing keeper fields then deletes empty losers in a transaction. UI and cron call the same executor; server always re-validates emptiness.

**Tech Stack:** Next.js App Router, Prisma/Postgres, Vitest, existing audit + cron-auth patterns.

**Spec:** `app/docs/superpowers/specs/2026-07-30-patient-duplicate-merge-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `app/src/lib/patients/duplicate-attachments.ts` | Full emptiness / attachment counts for a set of patient IDs |
| `app/src/lib/patients/duplicate-cleanup.ts` | Extend `PatientAttachmentCounts` + `pickPatientToKeep` to use full scores |
| `app/src/lib/patients/duplicate-merge-plan.ts` | Pure: strong signal, classify group, field-fill plan, bulk plans |
| `app/src/lib/patients/duplicate-merge.ts` | DB executor: validate, fill fields, delete shells, audit |
| `app/src/lib/practice-settings.ts` | Read/write `autoMergeEmptyDuplicates` |
| `app/prisma/schema.prisma` + migration | New boolean on `PracticeSetting` |
| `app/src/app/api/patients/duplicates/merge/route.ts` | Manual single + bulk merge (ADMIN) |
| `app/src/app/api/patients/duplicates/auto-merge/route.ts` | Cron auto-merge when setting on |
| `app/vercel.json` | Daily cron entry |
| `app/src/components/patient-duplicate-merge-button.tsx` | Confirm + call merge API (single group) |
| `app/src/components/patient-duplicate-bulk-merge-button.tsx` | Bulk safe merge |
| `app/src/components/auto-merge-duplicates-setting.tsx` | Toggle practice setting on duplicati page |
| `app/src/app/[locale]/(app)/pazienti/duplicati/page.tsx` | Keeper badge, emptiness, merge/bulk, setting |
| Tests alongside each module | Unit + route tests |

---

### Task 1: Full attachment counts

**Files:**
- Create: `app/src/lib/patients/duplicate-attachments.ts`
- Create: `app/src/lib/patients/__tests__/duplicate-attachments.test.ts`
- Modify: `app/src/lib/patients/duplicate-cleanup.ts`
- Modify: `app/src/lib/patients/__tests__/duplicate-cleanup.test.ts`

- [ ] **Step 1: Write failing tests for emptiness helpers**

```ts
// app/src/lib/patients/__tests__/duplicate-attachments.test.ts
import { describe, expect, it } from "vitest";
import {
  isPatientEmptyShell,
  type FullPatientAttachmentCounts,
  sumAttachmentScore,
} from "@/lib/patients/duplicate-attachments";

const empty: FullPatientAttachmentCounts = {
  appointmentCount: 0,
  appointmentReminderCount: 0,
  paymentCount: 0,
  quoteCount: 0,
  cashAdvanceCount: 0,
  financeEntryCount: 0,
  dentalRecordCount: 0,
  clinicalNoteCount: 0,
  consentCount: 0,
  recallCount: 0,
  recurringMessageLogCount: 0,
  stockMovementCount: 0,
  smsLogCount: 0,
};

describe("isPatientEmptyShell", () => {
  it("is true when all counts are zero", () => {
    expect(isPatientEmptyShell(empty)).toBe(true);
  });

  it("is false when any linked row exists", () => {
    expect(isPatientEmptyShell({ ...empty, appointmentCount: 1 })).toBe(false);
    expect(isPatientEmptyShell({ ...empty, paymentCount: 2 })).toBe(false);
  });
});

describe("sumAttachmentScore", () => {
  it("sums all attachment counters", () => {
    expect(sumAttachmentScore({ ...empty, paymentCount: 2, dentalRecordCount: 1 })).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/lib/patients/__tests__/duplicate-attachments.test.ts`

Expected: FAIL (module not found)

- [ ] **Step 3: Implement attachment types and pure helpers**

```ts
// app/src/lib/patients/duplicate-attachments.ts
export type FullPatientAttachmentCounts = {
  appointmentCount: number;
  appointmentReminderCount: number;
  paymentCount: number;
  quoteCount: number;
  cashAdvanceCount: number;
  financeEntryCount: number;
  dentalRecordCount: number;
  clinicalNoteCount: number;
  consentCount: number;
  recallCount: number;
  recurringMessageLogCount: number;
  stockMovementCount: number;
  smsLogCount: number;
};

export const EMPTY_ATTACHMENT_COUNTS: FullPatientAttachmentCounts = {
  appointmentCount: 0,
  appointmentReminderCount: 0,
  paymentCount: 0,
  quoteCount: 0,
  cashAdvanceCount: 0,
  financeEntryCount: 0,
  dentalRecordCount: 0,
  clinicalNoteCount: 0,
  consentCount: 0,
  recallCount: 0,
  recurringMessageLogCount: 0,
  stockMovementCount: 0,
  smsLogCount: 0,
};

export function sumAttachmentScore(counts: FullPatientAttachmentCounts): number {
  return (
    counts.appointmentCount +
    counts.appointmentReminderCount +
    counts.paymentCount +
    counts.quoteCount +
    counts.cashAdvanceCount +
    counts.financeEntryCount +
    counts.dentalRecordCount +
    counts.clinicalNoteCount +
    counts.consentCount +
    counts.recallCount +
    counts.recurringMessageLogCount +
    counts.stockMovementCount +
    counts.smsLogCount
  );
}

export function isPatientEmptyShell(counts: FullPatientAttachmentCounts): boolean {
  return sumAttachmentScore(counts) === 0;
}
```

- [ ] **Step 4: Add `loadFullAttachmentCounts(patientIds)` using prisma groupBy / count**

Implement async loader that initializes every id with `EMPTY_ATTACHMENT_COUNTS`, then fills from parallel `groupBy` / `count` queries on each model filtered by `patientId in patientIds`. For optional/null patientId models (`StockMovement`, `FinanceEntry`, etc.), still group where `patientId` is in the set.

Also export a thin adapter:

```ts
export function toLegacyAttachmentCounts(
  full: FullPatientAttachmentCounts,
): { paymentCount: number; dentalRecordCount: number } {
  return {
    paymentCount: full.paymentCount,
    dentalRecordCount: full.dentalRecordCount,
  };
}
```

- [ ] **Step 5: Update `pickPatientToKeep` to rank by `sumAttachmentScore` when full counts are provided**

Change `PatientAttachmentCounts` to either:

```ts
export type PatientAttachmentCounts = FullPatientAttachmentCounts;
```

or accept both and prefer full score. Simplest: redefine:

```ts
import {
  type FullPatientAttachmentCounts,
  sumAttachmentScore,
} from "@/lib/patients/duplicate-attachments";

export type PatientAttachmentCounts = FullPatientAttachmentCounts;
```

Update ranking:

```ts
const leftAttachmentScore = sumAttachmentScore(leftCounts);
const rightAttachmentScore = sumAttachmentScore(rightCounts);
```

Update reason strings to mention generic "dati collegati" with a short detail list (payments, appointments, dental records if &gt; 0).

Update `duplicate-cleanup.test.ts` fixtures to use full count objects (spread `EMPTY_ATTACHMENT_COUNTS`).

- [ ] **Step 6: Run tests**

Run: `cd app && npx vitest run src/lib/patients/__tests__/duplicate-attachments.test.ts src/lib/patients/__tests__/duplicate-cleanup.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/patients/duplicate-attachments.ts \
  app/src/lib/patients/__tests__/duplicate-attachments.test.ts \
  app/src/lib/patients/duplicate-cleanup.ts \
  app/src/lib/patients/__tests__/duplicate-cleanup.test.ts
git commit -m "feat(patients): full attachment counts for duplicate ranking"
```

---

### Task 2: Pure merge plan (classify + field fill)

**Files:**
- Create: `app/src/lib/patients/duplicate-merge-plan.ts`
- Create: `app/src/lib/patients/__tests__/duplicate-merge-plan.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  buildFieldFillPlan,
  classifyDuplicateGroup,
  hasStrongMatchSignal,
  type MergePatientSnapshot,
} from "@/lib/patients/duplicate-merge-plan";
import { EMPTY_ATTACHMENT_COUNTS } from "@/lib/patients/duplicate-attachments";
import type { PotentialDuplicateGroup } from "@/lib/patients/duplicate-detection";

const snap = (
  id: string,
  overrides: Partial<MergePatientSnapshot> = {},
): MergePatientSnapshot => ({
  id,
  firstName: "Mario",
  lastName: "Rossi",
  email: null,
  phone: null,
  birthDate: null,
  gender: "NOT_SPECIFIED",
  notes: null,
  photoUrl: null,
  hasPaperConsentForRequired: false,
  taxId: null,
  createdAt: new Date("2026-01-01T10:00:00.000Z"),
  ...overrides,
});

describe("hasStrongMatchSignal", () => {
  it("is true for taxId", () => {
    expect(hasStrongMatchSignal([{ kind: "taxId", label: "CF", value: "X", patientIds: ["a", "b"] }])).toBe(true);
  });

  it("is true for nameBirthDate plus phone", () => {
    expect(
      hasStrongMatchSignal([
        { kind: "nameBirthDate", label: "N", value: "v", patientIds: ["a", "b"] },
        { kind: "phone", label: "T", value: "v", patientIds: ["a", "b"] },
      ]),
    ).toBe(true);
  });

  it("is false for nameBirthDate alone", () => {
    expect(
      hasStrongMatchSignal([{ kind: "nameBirthDate", label: "N", value: "v", patientIds: ["a", "b"] }]),
    ).toBe(false);
  });
});

describe("classifyDuplicateGroup", () => {
  it("marks group safe when only keeper has attachments", () => {
    const group: PotentialDuplicateGroup = {
      id: "g1",
      matchSignals: [{ kind: "taxId", label: "CF", value: "RSSMRA80A01H501U", patientIds: ["keep", "shell"] }],
      patients: [
        {
          id: "keep",
          firstName: "Mario",
          lastName: "Rossi",
          email: "m@example.com",
          phone: null,
          birthDate: null,
          taxId: "RSSMRA80A01H501U",
          createdAt: new Date("2026-01-01"),
        },
        {
          id: "shell",
          firstName: "Mario",
          lastName: "Rossi",
          email: null,
          phone: "+393331111111",
          birthDate: new Date("1980-01-01"),
          taxId: "RSSMRA80A01H501U",
          createdAt: new Date("2026-01-02"),
        },
      ],
    };
    const counts = new Map([
      ["keep", { ...EMPTY_ATTACHMENT_COUNTS, paymentCount: 1 }],
      ["shell", { ...EMPTY_ATTACHMENT_COUNTS }],
    ]);
    const result = classifyDuplicateGroup(group, counts);
    expect(result.safe).toBe(true);
    expect(result.autoEligible).toBe(true);
    expect(result.keepPatientId).toBe("keep");
    expect(result.deletePatientIds).toEqual(["shell"]);
  });

  it("is unsafe when two patients have attachments", () => {
    const group: PotentialDuplicateGroup = {
      id: "g2",
      matchSignals: [{ kind: "taxId", label: "CF", value: "X", patientIds: ["a", "b"] }],
      patients: [
        { id: "a", firstName: "A", lastName: "A", email: null, phone: null, birthDate: null, taxId: "X", createdAt: new Date() },
        { id: "b", firstName: "B", lastName: "B", email: null, phone: null, birthDate: null, taxId: "X", createdAt: new Date() },
      ],
    };
    const counts = new Map([
      ["a", { ...EMPTY_ATTACHMENT_COUNTS, appointmentCount: 1 }],
      ["b", { ...EMPTY_ATTACHMENT_COUNTS, dentalRecordCount: 1 }],
    ]);
    expect(classifyDuplicateGroup(group, counts).safe).toBe(false);
  });
});

describe("buildFieldFillPlan", () => {
  it("fills only empty keeper fields from losers", () => {
    const plan = buildFieldFillPlan(
      snap("keep", { email: "keep@example.com", phone: null, notes: null }),
      [snap("shell", { email: "other@example.com", phone: "+393339999999", notes: "Codice Fiscale: RSSMRA80A01H501U" })],
    );
    expect(plan.filledFields).toEqual(expect.arrayContaining(["phone", "codiceFiscale"]));
    expect(plan.data.email).toBeUndefined();
    expect(plan.data.phone).toBe("+393339999999");
  });

  it("does not overwrite existing tax id in notes", () => {
    const plan = buildFieldFillPlan(
      snap("keep", { notes: "Codice Fiscale: KEEPID" }),
      [snap("shell", { notes: "Codice Fiscale: SHELLID" })],
    );
    expect(plan.filledFields).not.toContain("codiceFiscale");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd app && npx vitest run src/lib/patients/__tests__/duplicate-merge-plan.test.ts`

- [ ] **Step 3: Implement `duplicate-merge-plan.ts`**

Key exports:

```ts
export type MergePatientSnapshot = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  birthDate: Date | null;
  gender: string; // Gender enum value
  notes: string | null;
  photoUrl: string | null;
  hasPaperConsentForRequired: boolean;
  taxId: string | null; // parsed for ranking convenience
  createdAt: Date;
};

export type ClassifiedDuplicateGroup = {
  groupId: string;
  keepPatientId: string;
  deletePatientIds: string[];
  safe: boolean;
  autoEligible: boolean;
  strong: boolean;
  reason: string;
};

export function hasStrongMatchSignal(signals: DuplicateMatchSignal[]): boolean;
export function classifyDuplicateGroup(
  group: PotentialDuplicateGroup,
  countsByPatientId: Map<string, FullPatientAttachmentCounts>,
): ClassifiedDuplicateGroup;

export type FieldFillPlan = {
  data: {
    email?: string;
    phone?: string;
    birthDate?: Date;
    photoUrl?: string;
    hasPaperConsentForRequired?: boolean;
    notes?: string;
  };
  filledFields: string[];
};

export function buildFieldFillPlan(
  keeper: MergePatientSnapshot,
  losers: MergePatientSnapshot[],
): FieldFillPlan;
```

`hasStrongMatchSignal`: true if any signal `kind === "taxId"`, or (`nameBirthDate` present and (`phone` or `email` present)).

`classifyDuplicateGroup`: use `pickPatientToKeep` with full counts; `deletePatientIds` = others; `safe` if every delete id is empty shell; `strong` from signals; `autoEligible = safe && strong`.

`buildFieldFillPlan`: iterate losers in createdAt order; for each field if keeper empty and loser has value, take first non-empty. Notes: parse with `parsePatientStructuredNotes`; rebuild notes string filling missing structured lines (CF, Indirizzo, Anamnesi, Farmaci, Note aggiuntive) without dropping freeform lines. Mirror the macOS note merge structure in `macos-patient-sync.ts` but multi-source fill-only.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/patients/duplicate-merge-plan.ts \
  app/src/lib/patients/__tests__/duplicate-merge-plan.test.ts
git commit -m "feat(patients): classify safe duplicate merges and field fill plans"
```

---

### Task 3: Merge executor (DB)

**Files:**
- Create: `app/src/lib/patients/duplicate-merge.ts`
- Create: `app/src/lib/patients/__tests__/duplicate-merge.test.ts`

- [ ] **Step 1: Write failing tests with prisma mocked**

Pattern like `delete-patient.test.ts`: hoisted mocks for `patient.findMany`, `patient.update`, transaction, `loadFullAttachmentCounts`, `deletePatientWithRelations`, `logAudit`.

Cases:
1. Rejects when a delete target has attachments
2. Updates keeper fields then deletes empty losers
3. Returns filled field list

- [ ] **Step 2: Implement executor**

```ts
export type MergeTrigger = "ui" | "bulk" | "cron";

export type MergeEmptyShellsInput = {
  keepPatientId: string;
  deletePatientIds: string[];
  actor: { id?: string | null; role?: Role | null } | null; // match logAudit actor shape used elsewhere
  trigger: MergeTrigger;
  requireStrong?: boolean; // true for cron
};

export type MergeEmptyShellsResult =
  | { ok: true; keepPatientId: string; deletedPatientIds: string[]; filledFields: string[] }
  | { ok: false; error: string; code: "NOT_FOUND" | "NOT_EMPTY" | "NOT_SAFE" | "NOT_STRONG" | "INVALID" };
```

Flow:
1. Normalize unique delete ids; reject if empty or includes keep
2. `loadFullAttachmentCounts([keep, ...deletes])`
3. If any delete not empty → `NOT_EMPTY`
4. Load patient rows with fields needed for snapshot (include notes, photo, gender, hasPaperConsentForRequired)
5. Build snapshots (parse taxId from notes)
6. If `requireStrong`, re-run detection signals for these patients only OR accept caller-provided strong flag after re-detecting group — **prefer re-detect**: load all patients is heavy; for single merge, require that callers already classified, but still re-check emptiness. For strong: recompute by calling `findPotentialPatientDuplicates` on the small set of patients involved.
7. `buildFieldFillPlan`
8. `prisma.$transaction`: update keeper if fields; for each delete id `deletePatientWithRelations(id, tx)`
9. `logAudit` with action `patient.duplicates_merged` or `patient.duplicates_auto_merged` when trigger is `cron`

Also export:

```ts
export async function mergeAllSafeEmptyShellGroups(options: {
  actor: ...;
  trigger: MergeTrigger;
  autoEligibleOnly: boolean;
}): Promise<{ merged: number; deleted: number; skipped: number; errors: string[] }>
```

Implementation: load all patients (same select as duplicati page), detect groups, load counts for all duplicate ids, classify each, for each matching class call single merge.

- [ ] **Step 3: Run tests — PASS**

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/patients/duplicate-merge.ts \
  app/src/lib/patients/__tests__/duplicate-merge.test.ts
git commit -m "feat(patients): execute empty-shell duplicate merges"
```

---

### Task 4: Practice setting + migration

**Files:**
- Modify: `app/prisma/schema.prisma` (`PracticeSetting`)
- Create: `app/prisma/migrations/20260730120000_add_auto_merge_empty_duplicates/migration.sql`
- Modify: `app/src/lib/practice-settings.ts`
- Create or extend tests for practice settings if present

- [ ] **Step 1: Schema**

```prisma
model PracticeSetting {
  id                        String   @id @default("default")
  timeZone                  String   @default("Europe/Rome")
  autoMergeEmptyDuplicates  Boolean  @default(false)
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt
}
```

- [ ] **Step 2: Migration SQL**

```sql
ALTER TABLE "PracticeSetting" ADD COLUMN "autoMergeEmptyDuplicates" BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 3: Settings helpers**

```ts
export async function getAutoMergeEmptyDuplicates(): Promise<boolean>
export async function saveAutoMergeEmptyDuplicates(enabled: boolean): Promise<boolean>
```

Follow the same optional-model / upsert pattern as `getPracticeTimeZone` / `savePracticeTimeZone` so missing model does not crash older deploys.

- [ ] **Step 4: Commit**

```bash
git add app/prisma/schema.prisma \
  app/prisma/migrations/20260730120000_add_auto_merge_empty_duplicates \
  app/src/lib/practice-settings.ts
git commit -m "feat(settings): opt-in autoMergeEmptyDuplicates practice flag"
```

---

### Task 5: Merge API (manual single + bulk)

**Files:**
- Create: `app/src/app/api/patients/duplicates/merge/route.ts`
- Create: `app/src/app/api/patients/duplicates/merge/route.test.ts`

- [ ] **Step 1: Route implementation**

```ts
// POST body:
// { mode?: "single" | "safe_all", keepPatientId?, deletePatientIds?, confirmation }
```

- Require ADMIN via `requireUser([Role.ADMIN])`
- Require `hasTypedConfirmation(confirmation, DELETE_CONFIRMATION_TEXT)` (reuse `ELIMINA`)
- `mode === "safe_all"` → `mergeAllSafeEmptyShellGroups({ trigger: "bulk", autoEligibleOnly: false })`
- else → `mergeEmptyDuplicateShells({ keepPatientId, deletePatientIds, trigger: "ui" })`
- `revalidatePath` for `/pazienti`, `/pazienti/duplicati`, keeper path
- Return JSON `{ ok, ... }`

- [ ] **Step 2: Route tests**

Mock auth, executor, confirmation. Assert 400 without confirmation; 200 on success; bulk calls bulk helper.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/api/patients/duplicates/merge
git commit -m "feat(api): patient duplicate empty-shell merge endpoint"
```

---

### Task 6: Auto-merge cron route

**Files:**
- Create: `app/src/app/api/patients/duplicates/auto-merge/route.ts`
- Create: `app/src/app/api/patients/duplicates/auto-merge/route.test.ts`
- Modify: `app/vercel.json`
- Modify: `app/tests/deployment-cron-config.test.ts` if it asserts cron list

- [ ] **Step 1: Route**

```ts
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!(await validateCronSecret(req))) {
    return unauthorizedCronResponse(req, "patient_duplicates_auto_merge");
  }
  const enabled = await getAutoMergeEmptyDuplicates();
  if (!enabled) {
    return NextResponse.json({ ok: true, skipped: true, reason: "setting_disabled" });
  }
  const result = await mergeAllSafeEmptyShellGroups({
    actor: null,
    trigger: "cron",
    autoEligibleOnly: true,
  });
  return NextResponse.json({ ok: true, ...result });
}
```

- [ ] **Step 2: vercel.json**

```json
{
  "path": "/api/patients/duplicates/auto-merge",
  "schedule": "15 6 * * *"
}
```

- [ ] **Step 3: Update cron config test** to expect the new path

- [ ] **Step 4: Tests for setting off/on**

- [ ] **Step 5: Commit**

```bash
git add app/src/app/api/patients/duplicates/auto-merge \
  app/vercel.json \
  app/tests/deployment-cron-config.test.ts
git commit -m "feat(cron): opt-in auto-merge for strong empty-shell duplicates"
```

---

### Task 7: UI components + duplicati page

**Files:**
- Create: `app/src/components/patient-duplicate-merge-button.tsx`
- Create: `app/src/components/patient-duplicate-bulk-merge-button.tsx`
- Create: `app/src/components/auto-merge-duplicates-setting.tsx`
- Modify: `app/src/app/[locale]/(app)/pazienti/duplicati/page.tsx`
- Modify: `app/src/app/[locale]/(app)/pazienti/duplicati/page.test.tsx`
- Modify: `app/src/components/duplicate-legend-help-tooltip.tsx` (help text)

- [ ] **Step 1: Merge button (client)**

Props: `keepPatientId`, `deletePatientIds`, `filledFieldsPreview: string[]`, `disabled?: boolean`

Mirrors `PatientDuplicateResolveButton`: dialog, type `ELIMINA`, POST `/api/patients/duplicates/merge` with single mode, toast, `router.refresh()`.

Italian copy: "Unisci in questa scheda", explain field fill + delete empty shells.

- [ ] **Step 2: Bulk button**

Props: `safeGroupCount: number`

POST `{ mode: "safe_all", confirmation }`. Only render if count &gt; 0 and ADMIN.

- [ ] **Step 3: Setting toggle (client)**

Use a small server action or POST to a minimal settings endpoint. Prefer server action in `app/src/app/_actions/practice-settings.ts`:

```ts
export async function saveAutoMergeEmptyDuplicatesAction(formData: FormData) {
  const user = await requireUser([Role.ADMIN]);
  const enabled = formData.get("enabled") === "true" || formData.get("enabled") === "on";
  await saveAutoMergeEmptyDuplicates(enabled);
  await logAudit(user, { action: "practice.auto_merge_duplicates_updated", ...});
  revalidatePath("/pazienti/duplicati");
}
```

Checkbox form on page for ADMIN.

- [ ] **Step 4: Wire page**

On `PazientiDuplicatiPage`:
1. Load full attachment counts for duplicate patient ids via `loadFullAttachmentCounts`
2. For each group, `classifyDuplicateGroup`
3. Load full patient fields for merge snapshots if needed for field-fill preview (email/phone already loaded; add `photoUrl`, `hasPaperConsentForRequired`, `gender` to select)
4. Per group header: show "Unione sicura" / "Auto-unibile" badges
5. On suggested keeper card: "Consigliata da mantenere" badge
6. On each patient: "Vuota" vs "Ha dati"
7. If `classification.safe && user.role === ADMIN`: show merge button on keeper with preview from `buildFieldFillPlan`
8. Remove or demote "Elimina duplicati" resolve button for safe groups (prefer merge). Keep `PatientDeleteButton` for incomplete non-merge cases if still useful
9. Top banner: bulk merge + auto setting + counts of safe / auto-eligible

- [ ] **Step 5: Update help tooltip text** to mention unione schede vuote and auto setting

- [ ] **Step 6: Update page tests** (mock new components if needed; assert suggested keeper text when groups present)

- [ ] **Step 7: Run relevant tests**

```bash
cd app && npx vitest run src/lib/patients src/app/api/patients/duplicates src/app/\[locale\]/\(app\)/pazienti/duplicati
```

- [ ] **Step 8: Commit**

```bash
git add app/src/components/patient-duplicate-merge-button.tsx \
  app/src/components/patient-duplicate-bulk-merge-button.tsx \
  app/src/components/auto-merge-duplicates-setting.tsx \
  app/src/components/duplicate-legend-help-tooltip.tsx \
  app/src/app/_actions/practice-settings.ts \
  app/src/app/\[locale\]/\(app\)/pazienti/duplicati \
  app/src/lib/practice-settings.ts
git commit -m "feat(ui): empty-shell merge and auto-merge setting on duplicati page"
```

---

### Task 8: Cleanup script alignment + verification

**Files:**
- Modify: `app/scripts/cleanup-duplicate-patients.ts` to use full counts + only delete empty shells (or call `mergeAllSafeEmptyShellGroups` dry-run style)
- Final test pass

- [ ] **Step 1: Update CLI** to refuse deleting non-empty losers (print skip), prefer merge path when `--execute`

- [ ] **Step 2: Full test suite for touched areas**

```bash
cd app && npx vitest run src/lib/patients src/app/api/patients/duplicates tests/deployment-cron-config.test.ts
```

Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add app/scripts/cleanup-duplicate-patients.ts
git commit -m "fix(scripts): only clean empty-shell patient duplicates"
```

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Full empty-shell definition | 1 |
| Keeper ranking with full attachments | 1 |
| Strong signal rules | 2 |
| Safe / auto-eligible classification | 2 |
| Field fill never overwrite | 2, 3 |
| Transaction delete empty losers | 3 |
| Audit actions | 3, 5, 6 |
| Practice setting default off | 4 |
| Manual single + bulk API | 5 |
| Cron auto-merge | 6 |
| UI badges, merge, bulk, toggle | 7 |
| CLI safety | 8 |

## Out of scope (do not implement)

- Relation reassignment for non-empty losers
- Fuzzy matching / ignore list
- Create-time hard block
