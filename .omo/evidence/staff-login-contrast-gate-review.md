# Staff Login Contrast Gate Review

recommendation: APPROVE

## Original Intent

The user reported that text inside the staff login credential boxes was unreadable, with dark text rendered on dark email/password inputs and a nearly unreadable forgot-password link.

## Desired Outcome

On the staff password sign-in route, entered email and password text must be clearly readable on both desktop and mobile, the forgot-password link must be readable, and the login form must show no blocking visual regression attributable to the contrast fix.

## Success Criteria

- CRIT-1: Entered email text is readable against the staff login input background on desktop and mobile.
- CRIT-2: Entered/masked password text is readable against the staff login input background on desktop and mobile.
- CRIT-3: The forgot-password link is readable on the dark login surface.
- CRIT-4: No blocking regression caused by the contrast fix is visible in the login form at the supplied desktop and mobile sizes.

## User Outcome Review

PASS. Direct inspection of both supplied PNGs shows light entered email text and light password bullets against dark slate input backgrounds. The forgot-password link is bright cyan and visually distinct from the dark form surface. Labels and the password-reveal icon are also visible. No clipping, overlap, or layout shift attributable to the contrast CSS is visible in the login form.

The mobile cookie/privacy panel overlays the lower portion of the form and likely covers the submit button until the user chooses a consent option. This is visible in the supplied screenshot but is not introduced by the reviewed CSS diff, remains dismissible through visible controls, and does not violate a stated contrast-fix criterion. Classified as a NOTE, not a blocker.

## Reproduced Evidence

- Input foreground `rgb(226,232,240)` against background `rgb(30,41,59)` independently computes to 11.87:1 contrast.
- Link foreground `rgb(34,211,238)` independently computes to 11.16:1 against the inner form surface represented by `rgb(2,6,23)`, and 8.09:1 even against the lighter input background.
- Desktop PNG was opened and inspected: 1600x1027, SHA-256 `9b81e891e5607f750db5c23d4e1e2bb5f0fc580d01306bdcdac7f9aa1388f8f7`.
- Mobile PNG was opened and inspected: actual artifact dimensions 390x937, SHA-256 `c4f2acdb888d8c11f65c15dc8621b2db5eb58620f48aaefc46a2b2b7d2919503`.
- Production CSS directly scopes readable foreground, background, border, caret, placeholder, label, reveal-button, and link colors to `.stack-auth-surface--staff`.
- The Playwright test fills both fields, measures input contrast against a 4.5 threshold, and checks the recovery-link computed color.

## Direct Slop And Programming Pass

- Production CSS is narrowly scoped to the staff Stack auth surface. The paired descendant/same-element selectors address third-party Stack DOM placement and do not introduce a new abstraction, parser, normalization layer, dead code, defensive branch, or unrelated behavior.
- The Playwright test is user-surface E2E coverage and would fail if input text returned to low contrast. It is not a deletion-only, requested-removal, tautological, snapshot, or production-implementation-mirroring test for the input behavior.
- NOTE: the forgot-password assertion pins the exact cyan value rather than measuring link contrast. This mirrors one CSS value and could provide false confidence if the background changed. It does not block this gate because CRIT-3 is directly established by the supplied screenshot and independently calculated contrast.
- NOTE: the custom RGB/contrast helpers are proportionate to the behavioral accessibility assertion. No unnecessary production extraction, parsing, normalization, or scope drift was found in the contrast-specific diff.
- The unrelated password-reset and Playwright host changes in the dirty worktree are outside this visual contrast review and were not treated as evidence for approval.

## Report-Coverage Check

No executor report, code-review report, manual-QA matrix, or notepad artifact was found under `.omo` or the searched workspace paths. Therefore there is no code-review report that explicitly records the same `programming` and `remove-ai-slops` perspectives. Per the gate instructions, this is recorded as an evidence gap rather than a rejection because the direct gate pass covers the requested outcome and no success criterion requires those reports as deliverables.

## Checked Artifact Paths

- `/tmp/poligest-staff-login-qa/staff-login-desktop-fixed.png`
- `/tmp/poligest-staff-login-qa/staff-login-mobile-fixed.png`
- `/Users/megov/code/poligest/app/src/app/globals.css`
- `/Users/megov/code/poligest/app/tests/smoke/staff-login-contrast.spec.ts`
- `/Users/megov/code/poligest/app/playwright.config.ts` (inspected to delimit unrelated worktree scope)
- `/Users/megov/code/poligest/app/src/app/[locale]/(app)/admin/utenti/page.tsx` (inspected to delimit unrelated worktree scope)
- `/Users/megov/code/poligest/app/src/lib/admin/stack-password-reset.ts` (inspected to delimit unrelated worktree scope)
- `/Users/megov/code/poligest/app/src/lib/admin/__tests__/stack-password-reset.test.ts` (inspected to delimit unrelated worktree scope)
- `/Users/megov/code/poligest/.omo` (searched for evidence/report/notepad artifacts)

## Evidence Gaps

- [evidence] The supplied description calls the mobile screenshot 390x844, but the PNG is actually 390x937. Mobile width and readability are still directly demonstrated; exact 390x844 height is not evidenced.
- [evidence] Existing claims that `npm run verify`, build, 464 Vitest tests, two Playwright smokes, and ESLint passed were not accompanied by durable output artifacts in the evidence directory. They are not relied upon for this visual-only approval.
- [evidence] No code-review report exists to confirm an earlier reviewer performed the required skill-perspective and overfit/slop coverage.
- [evidence] No manual-QA matrix or notepad path/artifact was supplied or discovered.

## Blockers

None.

