# poligest (SORRISO)

Practice management software for small dental clinics. Two parts: a Next.js web app for day-to-day operations, and **ScanID**, a macOS companion that scans Italian ID cards and creates patient records.

Production: [sorrisosplendente.com](https://sorrisosplendente.com)

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

### Main areas

Patients, appointments, dental charts, finance (quotes, payments, reports), inventory, recalls, consents, SMS, and role-based admin. Routes are under `app/src/app/[locale]/(app)/`; API routes under `app/src/app/api/`.

---

## ScanID (macOS)

Native app that uses Apple Vision to OCR Italian **Carta d'Identità Elettronica** and **Tessera Sanitaria** from the camera or a dropped image, then optionally creates a patient in Sorriso via `POST /api/patients`.

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