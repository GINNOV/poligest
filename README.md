# poligest (SORRISO)

SORRISO is practice management software for small dental clinics. It handles appointments, patient records, clinical documentation, billing, inventory, and the back-office work that keeps a studio running — with a separate patient login so people can check their own data from home.

Available in Italian and English (web app and ScanID). Built for Italian clinics — date formats, CIE and Tessera Sanitaria support via ScanID, codice fiscale handling.

Production: [sorrisosplendente.com](https://sorrisosplendente.com)

## What it does

The staff side manages the full appointment lifecycle — booking, confirmation, in-progress and completed states, no-shows, conflict detection, multi-doctor agendas, and calendar views. Secretaries and assistants create and manage users (doctors, staff, patients), each with a role that controls what they can see and do.

Patients log in with their own account. From the dashboard they see upcoming and past appointments, their latest signed quote with line items and outstanding balance, and recall reminders. They can update their profile, manage consents, and stay in touch with the practice without calling reception.

For clinical work, each patient has a full record: anamnesis, notes, consent modules (with optional Wacom signature pad), and a dental chart where doctors record what was done on each tooth — procedures, dates, treatment history, mouth-wide entries. Quotes tie clinical work to finance: line items, payments, down payments, daily and monthly reports, per-doctor breakdowns.

Behind that sits inventory (products, implants, suppliers, stock movements), automated and manual recall rules, recurring messages for closures and birthdays, SMS through ClickSend, WhatsApp reminder links for appointments and recalls, email templates, a daily agenda email to staff, and a weekly report for managers.

Administration covers database export and restore, user and role management, per-feature access control, a full audit trail of data changes, error reporting, privacy and GDPR tooling, service catalogues, and the ScanID API key for the Mac scanner.

## ScanID

A macOS companion for reception. Point the camera at an Italian ID card or drop a photo; Apple Vision reads it and the app parses name, birth date, gender, codice fiscale, and document number. It can derive codice fiscale from place of birth when needed. With one action, create a patient in Sorriso — optionally after confirmation, optionally opening the record in the browser. Does not replace the web app; it removes the typing step at intake.

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

Latest release: [ScanID 1.3.6](https://github.com/GINNOV/poligest/releases/tag/scanid-v1.3.6)

Direct DMG: [ScanID-1.3.6.dmg](https://github.com/GINNOV/poligest/releases/download/scanid-v1.3.6/ScanID-1.3.6.dmg)

Open the DMG, drag `ScanID.app` to Applications.

macOS Gatekeeper may block the first launch because the app is ad-hoc signed, not notarized. If you see *"ScanID" can't be opened* or similar:

1. Open **Applications** in Finder.
2. **Right-click** (or Control-click) `ScanID.app` → **Open**.
3. Click **Open** in the dialog to confirm you trust the app.

If it still won't run, open **System Settings → Privacy & Security**, scroll to the security message about ScanID, and click **Open Anyway**. Then launch the app once more.

### Build

Run from `macos/`:

```bash
./build.sh         # compile ScanID.app, ad-hoc sign
./create-dmg.sh    # package as ScanID-{version}.dmg
./verify.sh        # unit tests for card parsing logic
```

Icons live in `macos/Assets.xcassets` (Xcode asset catalog, App Store–ready). Source: `macos/Assets/AppIcon-1024.png`. Run `./generate-icon.sh` to regenerate all sizes, `Assets/AppIcon.icns`, and `macos/AppStore/MarketingIcon-1024.png` (upload this 1024×1024 PNG in App Store Connect if prompted separately from the bundle).

Open `ScanID.xcodeproj` in Xcode for Archive → Distribute App. The catalog includes all required macOS icon sizes (16 through 1024). Belfiore place-of-birth codes ship as `BelfioreCodes.json` (not compiled Swift) to keep Xcode builds fast.

To bump the version before building:

```bash
VERSION=1.2.0 ./build.sh && ./create-dmg.sh
```

(or edit `CFBundleShortVersionString` in `macos/Info.plist`)

For a Gatekeeper-approved distribution build, sign with a Developer ID Application
identity and notarize the DMG:

```bash
export SCANID_CODE_SIGN_IDENTITY="Developer ID Application: Your Team"
export SCANID_NOTARY_PROFILE="notarytool-profile"
VERSION=1.2.0 ./build.sh && ./create-dmg.sh
```

Without a Developer ID identity and notarization, the build is only ad-hoc signed
and `spctl` will reject it even when it is not quarantined.

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
| `SCANID_LATEST_VERSION` | `1.3.6` | Version string reported to the app |
| `SCANID_DOWNLOAD_URL` | [ScanID-1.3.6.dmg](https://github.com/GINNOV/poligest/releases/download/scanid-v1.3.6/ScanID-1.3.6.dmg) | Direct asset URL (DMG or ZIP) |
| `SCANID_RELEASE_NOTES` | _(empty)_ | Shown in the update dialog |

---

## License

Dual-licensed:

- Free for personal, educational, and non-commercial use
- Commercial use requires a paid license — see [COMMERCIAL.md](COMMERCIAL.md)

Full terms in [LICENSE](LICENSE).
