# Patient duplicate merge (Phase A)

## Status

Approved for implementation.

## Problem

`/pazienti/duplicati` finds potential duplicates but does not automate resolution. Staff must open cards, copy fields by hand, then delete. Resolve today is **hard delete** of other records (including their relations), which is unsafe when linked data exists and tedious when losers are empty shells.

## Goals

1. Suggest a **keeper** per group using attachment-aware ranking.
2. **One-click** and **bulk** merge for groups where every non-keeper is an empty shell (fill missing demographics on keeper, then delete empty losers).
3. **Opt-in auto-merge** for a stricter subset of those groups when a practice setting is enabled.
4. Never silently overwrite non-empty demographic fields or delete a patient that still has clinical/financial/agenda data.

## Non-goals (later phases)

- Reassigning relations when more than one patient in the group has linked data (true multi-record merge / Phase B).
- Fuzzy name matching, dismiss/ignore list, or create-time hard blocks (beyond optional future work).
- Always-on auto-merge without a practice setting.

## Definitions

### Empty shell

A patient is an empty shell if they have **zero** rows in all of:

- `Appointment`, `AppointmentReminder`
- `PatientPayment`, `Quote`, `CashAdvance`, `FinanceEntry`
- `DentalRecord`, `ClinicalNote`
- `PatientConsent`, `Recall`, `RecurringMessageLog`
- `StockMovement`, `SmsLog`

Demographics-only differences (email/phone/DOB/CF/notes/photo) do **not** disqualify emptiness.

### Keeper selection

Reuse and extend `pickPatientToKeep`:

1. Prefer patients with any linked data (using full attachment counts above, not only payments + dental records).
2. Higher total attachment count wins among those with data.
3. Then higher demographic completeness (email, phone, birthDate, taxId).
4. Then earlier `createdAt`, then stable `id`.

### Strong match signal

A group has a strong signal if **any** match signal in the group is:

- `taxId` (shared codice fiscale), or
- `nameBirthDate` **and** the same patients also share a normalized phone, or
- `nameBirthDate` **and** the same patients also share a normalized email

Implementation may express this as: group already has `taxId` signal, **or** has `nameBirthDate` plus (`phone` or `email`) involving the same patient set. Weak-only groups (e.g. only `nameBirthDate`, or only phone/email+name without DOB) are never auto-eligible.

### Group classes

| Class | Criteria | Manual merge | Auto-merge (setting on) |
|-------|----------|--------------|-------------------------|
| **Safe** | Exactly one keeper; every other member is empty shell | Yes | No (unless also strong) |
| **Safe + strong (auto-eligible)** | Safe **and** strong match signal | Yes | Yes |
| **Unsafe** | Two or more patients are non-empty | No (review / existing selective delete only) | No |

If **all** members are empty shells, the group is still **safe**: pick keeper by completeness/age, delete the rest after field fill.

## Merge algorithm

For a single group, given validated `keepPatientId` and `deletePatientIds`:

1. Load all patients and full emptiness flags; reject if any id missing, if keep is in delete list, or if any delete target is not empty.
2. Compute field fill plan: for each delete target, contribute values only into **empty** keeper fields:
   - `email`, `phone`, `birthDate`
   - tax ID and structured note fragments (CF, address, anamnesi, farmaci, extra) — fill missing pieces only; prefer existing macOS-style note merge helpers where practical
   - `photoUrl` if keeper has none
   - `hasPaperConsentForRequired`: set true if any loser is true and keeper is false
3. In one transaction:
   - apply keeper `Patient` update if any field fill
   - `deletePatientWithRelations` for each empty loser
4. Audit outside or after transaction as existing patterns require:
   - manual/bulk: `patient.duplicates_merged`
   - auto: `patient.duplicates_auto_merged`
   - metadata: `keptPatientId`, `deletedPatientIds`, `filledFields`, `matchSignals` / `strong`, `trigger` (`ui` | `bulk` | `cron` | `setting_test`)

No relation reassignment in Phase A: losers must be empty, so delete is sufficient.

## Manual UI (`/pazienti/duplicati`)

- Badge **Consigliata da mantenere** on suggested keeper.
- Badges **Vuota** / **Ha dati** (or equivalent) from full emptiness flags.
- For **safe** groups, ADMIN sees **Unisci in questa scheda** on the keeper (not only when demographics are “complete”).
- Confirm dialog summarizes: fields that will be filled, N empty cards deleted. Typed confirmation may be reused for consistency with destructive actions.
- Banner when safe count &gt; 0: **Unisci tutti i gruppi sicuri** (bulk, same algorithm).
- When auto-merge setting is on: short note that M auto-eligible groups may be merged by the scheduled job.
- Unsafe groups: keep open-scheda and existing selective delete; do not offer merge.

## Practice setting

- Add `autoMergeEmptyDuplicates Boolean @default(false)` on `PracticeSetting`.
- Default **off**.
- ADMIN toggle in practice/admin settings (near timezone is fine).
- When enabled, a cron route merges only **auto-eligible** groups (safe + strong).
- Audit when setting changes.

## APIs / jobs

### `POST /api/patients/duplicates/merge`

- Auth: ADMIN (align with current resolve).
- Body variants:
  - single: `{ keepPatientId, deletePatientIds, confirmation }`
  - bulk: `{ mode: "safe_all", confirmation }`
- Server re-detects groups / re-validates emptiness; never trusts client classification alone.
- Returns counts and per-group results (ok / skipped / error).

### Cron (or dedicated route)

- e.g. `POST /api/patients/duplicates/auto-merge` protected by existing cron secret.
- No-op if setting is false.
- Only processes auto-eligible groups.
- Idempotent: empty list is success.
- Schedule: daily is enough for v1 (document in `vercel.json`).

Optional later: run auto path after create/import; not required for v1.

## Domain modules

Prefer focused modules under `src/lib/patients/`:

- Extend attachment/emptiness counting (shared by ranking, UI, merge validation).
- `classifyDuplicateGroup` / plan builders: safe vs auto-eligible, keeper, delete ids, field-fill preview.
- `mergeEmptyDuplicateShells` executor used by UI API, bulk, and cron.
- Keep `findPotentialPatientDuplicates` as the detection source of truth.
- Existing hard-delete resolve path: leave for non-merge cases or retire from safe groups in UI so staff use merge instead.

## Testing

- Unit: emptiness classification; keeper ranking with full counts; field fill never overwrites; safe vs auto-eligible; strong-signal rules; bulk plan.
- API: refuse merge when a “loser” has an appointment/payment; accept empty-shell merge and assert keeper fields filled.
- Setting off → auto-merge no-op; setting on → only strong+safe groups merged.
- Page-level tests updated for suggested keeper / merge affordances where practical.

## Rollout / risk

- Setting defaults off → no production auto behavior until explicit enable.
- Manual merge still requires confirmation.
- Auto only deletes empty shells with strong identity match → low false-positive impact; wrong-but-empty duplicates still lose a redundant row only.
- Monitor audit actions after enable.

## Success criteria

- Staff can clear empty-shell backlog with one click per group or one bulk action.
- With the setting on, strong-match empty shells disappear without daily manual work.
- No patient with linked clinical/financial/agenda data is deleted by merge or auto-merge.
- Keeper demographics only gain previously missing values, never lose existing ones.
