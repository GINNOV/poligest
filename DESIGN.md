# SORRISO Design System

## 1. Atmosphere & Identity

SORRISO is an operational clinic command center: quiet, dense enough for repeat admin work, and explicit about state. The signature is restrained clinical depth: zinc surfaces, emerald action accents, and section-specific tinting for fast scanning.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/primary | `--surface-primary` | `white` | `zinc-950` | Page and card backgrounds |
| Surface/secondary | `--surface-secondary` | `zinc-50` | `zinc-900` | Rows, secondary panels |
| Text/primary | `--text-primary` | `zinc-900` | `zinc-50` | Headings and primary labels |
| Text/secondary | `--text-secondary` | `zinc-600` | `zinc-300` | Descriptions and supporting values |
| Text/muted | `--text-muted` | `zinc-500` | `zinc-400` | Captions and placeholders |
| Border/default | `--border-default` | `zinc-200` | `zinc-800` | Cards and dividers |
| Border/subtle | `--border-subtle` | `zinc-100` | `zinc-800` | Internal rows |
| Accent/primary | `--accent-primary` | `emerald-700` | `emerald-300` | Primary actions, admin hero |
| Accent/hover | `--accent-hover` | `emerald-600` | `emerald-400` | Hover and focus |
| Section/security | `--section-security` | `rose-50/rose-100` | `rose-950/zinc-950` | Privacy and security admin tiles |
| Section/system | `--section-system` | `purple-50/purple-100` | `purple-950/zinc-950` | System admin tiles |
| Status/warning | `--status-warning` | `amber-50/amber-800` | `amber-950/amber-200` | Missing configuration |

### Rules

- Emerald is the primary action color.
- Section colors are used only for grouping admin shortcuts.
- Token/code values use zinc rows with mono type.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| Display | `text-4xl md:text-5xl` | `font-extrabold` | `tracking-tight` | 0 | Admin dashboard title |
| H1 | `text-3xl` | `font-semibold` | default | 0 | Admin detail page title |
| H2 | `text-xl` | `font-bold` | default | 0 | Admin section title |
| Card title | `text-lg` | `font-bold` | `leading-tight` | 0 | Shortcut title |
| Body | `text-sm` | `font-normal` | `leading-relaxed` | 0 | Card descriptions |
| Caption | `text-xs` | `font-normal` | default | 0 | Metadata |
| Overline | `text-sm` | `font-semibold` | default | `tracking-wide` | Detail page eyebrow |

### Font Stack

- Primary: project default sans stack.
- Mono: project default mono stack via `font-mono`.

## 4. Spacing & Layout

### Base Unit

All spacing derives from 4px Tailwind spacing.

| Token | Value | Usage |
|-------|-------|-------|
| `space-2` | 8px | Inline icon and label gaps |
| `space-3` | 12px | Form and row gaps |
| `space-4` | 16px | Compact card groups |
| `space-5` | 20px | Detail cards |
| `space-6` | 24px | Shortcut cards and headers |
| `space-8` | 32px | Admin section spacing |
| `space-12` | 48px | Admin dashboard section rhythm |

### Grid

- Admin dashboard content width: `max-w-7xl`.
- Shortcut grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- Detail page cards: `grid-cols-1 lg:grid-cols-2`.

## 5. Components

### Admin Shortcut Card

- **Structure**: link or disabled div with icon block, title, badge, and one short description.
- **Variants**: primary, neutral, warning, section gradients.
- **Spacing**: `p-6`, `gap-4`, `space-y-4`.
- **States**: default, hover translate/shadow, disabled opacity/grayscale.
- **Accessibility**: full card is a link, disabled cards are non-interactive.
- **Motion**: 300ms transform and shadow transitions.

### Admin Detail Header

- **Structure**: tinted rounded panel with overline, H1, optional one short line.
- **Variants**: integration/security/system.
- **Spacing**: `p-6`, `mt-2`, `mt-3`.
- **States**: static.
- **Accessibility**: semantic heading.
- **Motion**: none.

### Token Card

- **Structure**: card title, status badge, mono token field, copy button.
- **Variants**: configured, missing.
- **Spacing**: `p-5`, `gap-2`, `space-y-3`.
- **States**: default, hover, focus, copied.
- **Accessibility**: copy button uses a real `button`; token field is selectable code text.
- **Motion**: 150ms hover color transition.

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | 150ms | ease-out | Button hover and copied state |
| Standard | 300ms | ease-in-out | Admin card hover |

Only transform, opacity, color, and shadow transitions are used in admin surfaces.

## 7. Depth & Surface

### Strategy

Mixed: cards use borders plus subtle shadows; section groups use tonal gradient backgrounds.

| Level | Value | Usage |
|-------|-------|-------|
| Card | `border border-zinc-200 bg-white shadow-sm` | Admin detail cards |
| Shortcut | `rounded-3xl border bg-gradient-to-br` | Admin dashboard tiles |
| Row | `border border-zinc-100 bg-zinc-50` | Token and status rows |
