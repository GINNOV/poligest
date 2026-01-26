# Repository Guidelines

## Project Structure & Module Organization
- `src/app/` holds the Next.js App Router routes, layouts, and global styles (`globals.css`).
- `src/components/` contains shared UI components; `src/actions/` holds server actions.
- `src/lib/` is for reusable utilities and domain helpers; `src/i18n/` and `src/messages/` manage localization.
- `prisma/` contains `schema.prisma`, migrations, and `seed.js` for database setup.
- `public/` is for static assets served at the site root.

## Build, Test, and Development Commands
- `npm run dev` starts the local Next.js dev server.
- `npm run build` runs `scripts/build-with-deploy-time.mjs` for production builds.
- `npm run start` builds then serves the production app.
- `npm run lint` runs ESLint (Next.js core-web-vitals + TypeScript rules).
- `npm run db:migrate` applies migrations using `.env.local`.
- `npm run db:migrate:dev` creates and applies dev migrations using `.env.local`.
- `npm run db:seed` seeds the database (`prisma/seed.js`).
- `npm run wacom:sync` syncs the Wacom SDK via `scripts/sync-wacom-sdk.mjs`.

## Coding Style & Naming Conventions
- TypeScript + React with Next.js 16; follow ESLint rules in `eslint.config.mjs`.
- Use 2-space indentation for JSON, and default TypeScript/JS formatting for `.ts`/`.tsx`.
- Prefer `PascalCase` for components, `camelCase` for functions/variables, and `kebab-case` for route segments.
- Tailwind CSS is available; prefer utility classes with `tailwind-merge` for class composition.

## Testing Guidelines
- No automated test framework is configured yet.
- If adding tests, place them alongside the module or in a `tests/` folder and document the command you add.

## Commit & Pull Request Guidelines
- Recent commits use short, imperative summaries (no strict conventional-commit format).
- Keep commits focused; include context in PR descriptions and link related issues.
- Include screenshots or recordings for UI changes, and note any DB migrations or config changes.

## Configuration & Data
- Local configuration is expected in `.env.local` (used by Prisma and scripts).
- Run `npm install` to trigger `prisma generate` via `postinstall`.
