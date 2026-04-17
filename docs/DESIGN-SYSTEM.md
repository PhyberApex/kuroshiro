# Kuroshiro UI — Design System Reference

This doc summarizes UI standards for the Kuroshiro frontend. Full design context and principles live in [CLAUDE.md](../CLAUDE.md).

## Foundation

- **Stack:** Vue 3, Vuetify 3
- **Theme:** Custom light/dark in `packages/ui/src/plugins/vuetify.ts` (monochrome, e-ink–aligned)
- **Principles:** Minimal, nerdy, monochrome; semantic color only for status

## Tokens & Conventions

### Color

- Use theme colors only: `primary`, `secondary`, `surface`, `background`, `error`, `warning`, `info`, `success`.
- Do not use non-theme names (e.g. `grey`, `orange`) or hard-coded hex in components; use theme tokens so light/dark stay consistent.
- Semantic colors: reserve for status (online/offline, battery, RSSI, logs, alerts).

### Spacing

- Use Vuetify spacing utilities: `mb-6`, `ms-2`, `ms-4`, `mt-5`, `pa-0`, etc. Do not add one-off margin/padding in scoped CSS unless needed for a single component (e.g. `min-height-auto` in expansion panels).
- Section spacing between cards: `mb-6` (Vuetify default scale).

### Elevation

- Cards: `elevation="1"` for a flat, minimal look.

### Components

- **Cards:** Prefer `v-card` with `elevation="1"`. Avoid nesting cards; use a simple text block or `v-alert` for inline context. Do not add redundant intro cards that restate the page title—rely on tab/nav and content for context.
- **Buttons:** Prefer `variant="tonal"` or `variant="text"`; use `color="primary"` for main actions, `color="secondary"` for secondary, `color="error"` for destructive.
- **Forms:** Use `density="compact"` where it keeps layout scannable; pair with Vuetify form components and validation rules.
- **Typography:** Use Vuetify typography classes (`text-body-2`, `text-caption`, `text-medium-emphasis`, `text-subtitle-2`, `font-weight-bold`) instead of ad-hoc font sizes/weights.

### Responsive

- Use `v-container fluid`, `v-row`, `v-col` with breakpoints (`cols="12" md="6"`). Wrap wide tables in `overflow-x-auto`.

## Where It Lives

| Concern        | Location |
|----------------|----------|
| Design context | [CLAUDE.md](../CLAUDE.md) |
| Theme (colors) | `packages/ui/src/plugins/vuetify.ts` |
| Meta theme-color | `packages/ui/src/App.vue` (`updateThemeColor`) |

---

*Keep this file in sync when changing theme, spacing, or component patterns.*
