# PoliGest Next.js Implementation Plan

## Goals
- Build an Italian-language clinic management app (agenda, EHR lite, inventory, finance, recalls) deployed on Vercel with EU-only data flows.
- Enforce GDPR and medical-data best practices: privacy by design, minimal data, auditability, encryption, secure hosting, and patient rights workflows.

## Architecture
- Next.js (App Router, TypeScript) with server components + server actions for mutations; Vercel deploy.
- Auth: NextAuth.js (email/password), strong password policy, inactivity timeout, brute-force protection, MFA-ready.
- RBAC: Roles (Admin, Manager, Secretary) enforced in middleware and on server actions; row-level checks in DB.
- Data: Postgres (EU region, e.g., Supabase/Neon) via Prisma; S3-compatible storage in EU for attachments with signed URLs.
- Background work: Vercel Cron + queue (e.g., Upstash Redis) for reminders/recalls; provider-agnostic messaging (email/SMS/WhatsApp).
- Monitoring: Sentry + structured logs (Pino); audit trail table for PHI and finance actions.

## Data & GDPR
- Data minimization: collect only necessary PII/PHI; per-field purpose tagging where possible.
- Consent: store explicit GDPR consent records with timestamps, scope, and channel; block processing if missing/expired.
- Data subject rights: implement “right to be forgotten” via anonymization of PII while preserving aggregated finance; export patient data on request (machine-readable).
- Encryption: TLS everywhere; at-rest encryption via managed DB/storage; app-level encryption for sensitive fields (e.g., using pgcrypto/AES-GCM) for contact and health history.
- Retention: define per-entity retention windows; scheduled purge/anonymize jobs.
- Access control: least privilege, per-role policies; sensitive views redacted for unauthorized roles.
- Logging/Audit: immutable audit log for view/edit of PHI, finance changes, login/security events; include user, timestamp, action, entity.
- Secrets: Vercel env vars with restricted scopes; no secrets in repo; rotate regularly.
- Backups/BCP: automated backups, tested restore; document RPO/RTO; restrict backup access; keep backups in EU.
- Legal: DPA with providers (DB, storage, comms); record sub-processors; cookie/policy banners as required.

## Domain Model (initial)
- Users (role, locale), Doctors, Patients (demographics, consents, contacts), Appointments (status, type, doctor), ClinicalNotes, TreatmentPlans, Attachments.
- Inventory: Products, Suppliers, StockMovements, Alerts.
- Finance: Expenses, PettyCash entries, CashAdvances, Settlements, Payments.
- Comms: CommunicationRules, Outbox/MessageLog for reminders/recalls/mass comms.

## Phases
- Phase 1 (MVP): Auth + RBAC; Patients CRUD with consents; Agenda (multi-doctor, statuses, color-coded types); simple clinical notes; audit log baseline; Italian UI.
- Phase 2 (Advanced): Finance (expenses, doctor %/fee calc, advances, settlements); Inventory (catalog, suppliers, stock in/out, low-stock alerts); treatment plans/estimates; manual recall queue.
- Phase 3 (Automation): Scheduled reminders/recalls; mass communications; reporting dashboards (revenue per doctor, expenses, doctor payouts); file uploads for attachments.

## Implementation Steps (next actions)
1) Scaffold Next.js app (TS, App Router) with lint/format; add next-intl/i18n for Italian UI defaults.
2) Wire NextAuth + Prisma + Postgres (EU); seed roles/users; add middleware for role-gated layouts and API/server actions.
3) Implement base schemas (users/doctors/patients/appointments/clinical notes) with Prisma migrations; add audit logging middleware.
4) Build Agenda and Patient flows (filters, statuses, creation/edit) with server actions; enforce consent checks before PHI access.
5) Add finance and inventory schemas + UI; encapsulate calculations (doctor %/fees, settlements) with tests.
6) Add comms queue and reminder/recall jobs via Vercel Cron + provider adapters; message logs and opt-out handling.
7) Integrate file uploads via presigned URLs; virus/mime checks; store metadata in Attachments.
8) Add reporting dashboards; optimize queries and caching for <1s agenda/search.
9) GDPR hardening: anonymization/export scripts, retention jobs, backup/restore test, DPA/sub-processor docs, cookie/privacy pages.
10) Testing: unit (RBAC, finance calc), integration (booking flow), e2e (Playwright for login/agenda/payout), security checks (rate limits, authz), and load smoke for agenda/search.
