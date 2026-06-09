# poligest aka SORRISO

SORRISO is a software suite designed to manage small dental practices. It consists of a modern Next.js web application and a native companion macOS utility, **ScanID**.

---

## 🖥️ Web Application (`/app`)

The core patient record management system built using Next.js, React, and Prisma.

### Useful Commands
- `npm run dev` - Starts the Next.js development server.
- `npm run build` - Performs a production build.
- `npm run test` - Runs the Vitest test suite.
- `npm run lint` - Runs ESLint.

---

## 🍎 ScanID macOS App (`/macos`)

A native companion utility written in Swift that utilizes Apple's Vision framework to scan Italian identity cards (Carta d'Identità Elettronica or Tessera Sanitaria) via the computer's camera or dropped images, and instantly sync patient records to the Sorriso Web App database.

### Features
- **OCR Scan**: Scans physical cards with visual guides and bounding boxes.
- **Auto-Sync**: Automatically pushes the details (Cognome, Nome, Codice Fiscale, etc.) to the Web App.
- **In-App Auto-Updates**: Checks for updates automatically. Downloads the DMG or ZIP package, extracts it, replaces the old app bundle, and relaunches the app natively in the background.

### Build & Verification Commands
All commands should be executed from the `macos` directory:
- `./build.sh` - Compiles the app bundle, writes it to `ScanID.app`, and performs ad-hoc code-signing.
- `./create-dmg.sh` - Packages the built `ScanID.app` into a clean drag-and-drop distribution DMG named `ScanID-[Version].dmg`.
- `./verify.sh` - Compiles and executes Swift-based unit tests for the card parsing logic.

### 🌐 Update API Configuration
The companion app pulls updates from the web app's `/api/scanid/meta` endpoint. You can control the version and package URL by defining the following environment variables on the web server:
- `SCANID_LATEST_VERSION` (defaults to `1.1.0`) - The latest version string (e.g., `1.2.0`).
- `SCANID_DOWNLOAD_URL` - The URL pointing to the latest zip or dmg package asset.
- `SCANID_RELEASE_NOTES` - Optional release notes displayed in the companion app's update dialog.

---

## 📄 License

This project is **dual-licensed**:
- ✅ Free for **personal, educational, and non-commercial use**
- 💼 **Commercial use requires a paid license**

See the [LICENSE](LICENSE) file for details and [COMMERCIAL.md](COMMERCIAL.md) for commercial licensing terms.
