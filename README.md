# poligest (SORRISO)

SORRISO runs a small dental practice from one place: patient records, scheduling, clinical work, billing, stock, and staff comms. The web app is where the clinic lives day to day. **ScanID** is a Mac utility that reads Italian ID cards at reception and opens a patient file without retyping.

Built for Italian clinics — UI copy, date formats, and document types (CIE, Tessera Sanitaria, codice fiscale) reflect that. The web app is in Italian; ScanID also supports English.

Production: [sorrisosplendente.com](https://sorrisosplendente.com)

### What the web app does

**Patients** — demographics, contacts, photos, duplicate detection, clinical notes, anamnesis, GDPR export. Interactive dental chart per tooth (conditions, treatments, history). Consent modules with optional Wacom signature capture.

**Scheduling** — multi-doctor agenda and calendar, appointment states (to confirm, confirmed, in progress, completed, no-show, etc.), conflict checks, WhatsApp reminder tracking, configurable reminder rules.

**Finance** — treatment quotes with line items, standard and down payments, daily/monthly/doctor expense reports, cash advances, payment methods (cash, card, transfer, pay later).

**Inventory** — products and implants as separate flows, suppliers, stock movements linked to patients where relevant.

**Recalls** — rule-based automatic recalls, manual recalls, recurring messages (holidays, closures, birthdays).

**Communications** — SMS via ClickSend, email templates, daily agenda email to staff, weekly practice report to managers.

**Admin** — users and roles (admin, manager, assistant, secretary, patient), per-role feature access, audit log, error reporting, privacy settings, service catalogue, anamnesis conditions, ScanID API key, data export/reset.

Patients can log in separately to book visits and manage their own consents.

### What ScanID does

Point the Mac camera at a **Carta d'Identità** or **Tessera Sanitaria** — or drop a photo — and ScanID extracts surname, name, birth date, gender, codice fiscale, document number, and related fields. It can compute codice fiscale from place of birth when the card doesn't show it.

From there, optionally push a new patient record to Sorriso (with confirmation, or fully automatic). Open the created record in the browser. Copy raw JSON for debugging.

Does not replace the web app. Handles the reception desk step of getting a patient into the system quickly.

## Repository layout

```
poligest/
├── app/          Next.js web application (patients, agenda, finance, inventory, admin)
├── macos/        ScanID — Swift/SwiftUI macOS app
├── web_assets/   Shared static assets (logos, avatars, favicons)
├── LICENSE
└── COMMERCIAL.md
```

## Web application

Stack: Next.js 16, React 19, Prisma 7, PostgreSQL, Tailwind 4, Vitest. Auth via Stack. Deployed on Vercel; pushes to `main` trigger production.

### Setup

Requires Node ≥ 22.

```bash
cd app
npm install          # runs prisma generate via postinstall
# create .env.local with DATABASE_URL, Stack auth keys, etc.
npm run db:migrate
npm run db:seed      # optional
npm run dev
```

Local config lives in `app/.env.local` (database URL, Stack keys, etc.).

### Commands

Run from `app/`:

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Build, then serve production |
| `npm run test` | Vitest test suite |
| `npm run lint` | ESLint |
| `npm run verify` | Build + test + lint |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:migrate:dev` | Create and apply a dev migration |
| `npm run db:seed` | Seed the database |

CI (`.github/workflows/ci.yml`) runs build, test, and lint on every push and PR to `main`.

Routes: `app/src/app/[locale]/(app)/` · API: `app/src/app/api/`

---

## ScanID (macOS)

Swift/SwiftUI app using Apple Vision for OCR. Connects to Sorriso over HTTPS with an API key configured in `/admin/scanid`.

### Download

Latest release: [ScanID 1.1.0](https://github.com/GINNOV/poligest/releases/tag/scanid-v1.1.0)

Direct DMG: [ScanID-1.1.0.dmg](https://github.com/GINNOV/poligest/releases/download/scanid-v1.1.0/ScanID-1.1.0.dmg)

Open the DMG, drag `ScanID.app` to Applications.

### Build

Run from `macos/`:

```bash
./build.sh         # compile ScanID.app, ad-hoc sign
./create-dmg.sh    # package as ScanID-{version}.dmg
./verify.sh        # unit tests for card parsing logic
```

App icon source: `macos/Assets/AppIcon-1024.png`. Regenerate `.icns` and web PNG with `./generate-icon.sh`.

To bump the version before building:

```bash
VERSION=1.2.0 ./build.sh && ./create-dmg.sh
```

(or edit `CFBundleShortVersionString` in `macos/Info.plist`)

### Releasing a new version

1. Set the version in `Info.plist` (or via `VERSION=… ./build.sh`).
2. `./build.sh && ./create-dmg.sh`
3. Create a GitHub release and attach the DMG:

   ```bash
   gh release create scanid-v1.2.0 \
     --title "ScanID 1.2.0" \
     --notes "…" \
     ScanID-1.2.0.dmg
   ```

4. Update the default download URL in `app/src/app/api/scanid/meta/route.ts` and `app/src/app/[locale]/(app)/admin/scanid/page.tsx`, or set `SCANID_DOWNLOAD_URL` on Vercel.

### Integration with the web app

| Setting | Where | Purpose |
|---------|-------|---------|
| Server URL | ScanID preferences | Base URL of the Sorriso deployment (default: `https://sorrisosplendente.com`) |
| API key | ScanID preferences | Sent as `x-api-key` on patient creation |
| `MACOS_APP_API_KEY` | Web server env | Expected token for `POST /api/patients` (default in dev: `poligest_macos_secret`) |

Admin page for key and setup: `/admin/scanid`.

Extracted fields (surname, name, codice fiscale, birth date, gender, etc.) are parsed on the Mac. Only name, birth date, gender, email, phone, and notes are persisted to the `Patient` model today.

### Update checking

ScanID polls `GET {serverUrl}/api/scanid/meta` for `version`, `downloadUrl`, and optional `notes`.

- Automatic check on launch, at most once per 24 hours (toggle in preferences).
- Manual check via **Check for Updates** in settings.
- When a newer version is found, a dialog prompts the user to download and install. The install step replaces the app bundle from a DMG or ZIP and relaunches — it does not run fully silently.

Server-side overrides (Vercel env or code defaults):

| Variable | Default | Purpose |
|----------|---------|---------|
| `SCANID_LATEST_VERSION` | `1.1.0` | Version string reported to the app |
| `SCANID_DOWNLOAD_URL` | [ScanID-1.1.0.dmg](https://github.com/GINNOV/poligest/releases/download/scanid-v1.1.0/ScanID-1.1.0.dmg) | Direct asset URL (DMG or ZIP) |
| `SCANID_RELEASE_NOTES` | _(empty)_ | Shown in the update dialog |

---

## License

Dual-licensed:

- Free for personal, educational, and non-commercial use
- Commercial use requires a paid license — see [COMMERCIAL.md](COMMERCIAL.md)

Full terms in [LICENSE](LICENSE).