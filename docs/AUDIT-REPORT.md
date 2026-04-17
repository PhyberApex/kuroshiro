# Kuroshiro UI — Comprehensive Audit Report

**Audit date:** 2025-03-15  
**Scope:** `packages/ui` (Vue 3 + Vuetify 3)  
**Design reference:** CLAUDE.md (minimal, nerdy, monochrome, e-ink) + frontend-design skill anti-patterns

---

## Anti-Patterns Verdict

**Verdict: Pass with minor notes.**

The UI does **not** read as generic “AI slop.” It aligns with the project’s stated direction and avoids common anti-patterns:

| Check | Status | Notes |
|-------|--------|--------|
| AI color palette (cyan-on-dark, purple gradients, neon) | ✅ | Custom monochrome theme; tinted neutrals, semantic colors only for status. |
| Pure black/white | ✅ | Theme uses `#17181a`, `#fafbfc`, `#121318`, etc.—no `#000`/`#fff`. |
| Gradient text, glassmorphism, hero metrics | ✅ | None present. |
| Bounce/elastic easing | ✅ | Route transition uses `cubic-bezier(0.25, 1, 0.5, 1)`; `prefers-reduced-motion` respected. |
| Redundant intro copy | ✅ | Removed in prior passes; empty states are short. |
| Nested cards (card-in-card) | ⚠️ | **DeviceLogsCard**: `v-card` inside expansion panel for “Device Status” / “Additional Info” (lines 143–228). Functional grouping only; could be simplified to a non-card container. |
| “Wrap everything in cards” | ⚠️ | Every section is a card. Acceptable for this dashboard; consistent with “card-based layouts” in CLAUDE.md. |
| Overused fonts | ⚠️ | Vuetify default (Roboto) is in the frontend-design “DON’T” list. Project has not opted into a distinctive typeface; acceptable for minimal/tool-first. |

**Summary:** No critical anti-patterns. One optional simplification (nested card in logs) and one conscious choice (default font). The interface reads as intentional and on-brand, not template-like.

---

## Executive Summary

| Metric | Value |
|--------|--------|
| **Total issues** | 10 (0 Critical, 2 High, 4 Medium, 4 Low) |
| **Categories** | Accessibility, Responsive, Theming/Typography, Minor consistency |
| **Overall** | Solid quality. Navigation, theming, performance, and content are in good shape. Remaining work is mostly accessibility polish, responsive behavior of the app bar, and optional typography/token upgrades. |

**Top issues**

1. **ScreenListCard overlay iframe** — Missing `title` attribute (accessibility).
2. **App bar on narrow viewports** — Four tabs may overflow or crowd; behavior not explicitly tuned for small screens.
3. **Semantic headings** — No explicit `h1`/section structure; card titles may not expose proper heading levels.
4. **Theme colors in theme** — Hex in Vuetify theme (not oklch/fluid); optional modernization.
5. **MAC copy control** — No dedicated accessible name for “copy to clipboard” action.

**Recommended next steps**

1. Add `title="HTML preview"` to the ScreenListCard overlay iframe; consider `aria-label` on overlay close if not obvious.
2. Confirm app bar tabs on mobile (scroll, collapse, or drawer-only) and document or adjust.
3. Optionally run `/polish` for heading semantics and any remaining a11y tweaks; `/normalize` if you want to push typography or design tokens further.

---

## Detailed Findings by Severity

### Critical

*None.*

---

### High

#### H1. ScreenListCard overlay iframe missing accessible name

- **Location:** `packages/ui/src/components/ScreenListCard.vue` (line 144)
- **Category:** Accessibility
- **Description:** The overlay iframe used for HTML preview has no `title` attribute. AddScreenCard’s overlay iframe has `title="HTML preview"`; this one does not.
- **Impact:** Screen reader users get no context for the iframe; fails WCAG 2.1 (name, role, value).
- **WCAG:** 4.1.2 (Name, Role, Value)
- **Recommendation:** Add `title="HTML preview"` (or equivalent) to the iframe.
- **Suggested command:** `/polish` or manual fix.

#### H2. App bar tabs on narrow viewports

- **Location:** `packages/ui/src/App.vue` (v-tabs with four items)
- **Category:** Responsive
- **Description:** Four tabs (Overview, Maintenance, Virtual Device, HTML Preview) in the app bar may overflow or feel cramped on small screens. Vuetify tabs often scroll; behavior is not explicitly verified or documented.
- **Impact:** On phones or narrow windows, primary nav may be harder to use or discover.
- **Recommendation:** Test on 320px–480px width; if tabs scroll, document. If they overflow, consider responsive behavior (e.g. fewer visible tabs, “More” menu, or rely on drawer and simplify/remove bar tabs on small breakpoints).
- **Suggested command:** `/adapt` or manual responsive pass.

---

### Medium

#### M1. No explicit page/section heading hierarchy

- **Location:** All views (e.g. `OverviewView.vue`, `DeviceDetailsView.vue`)
- **Category:** Accessibility (semantic structure)
- **Description:** Views use `v-card-title` and section titles but there is no explicit `h1` (page purpose) or ordered `h2`/`h3` structure. Card titles may not be exposed as headings.
- **Impact:** Screen reader and outline users get a flatter structure; harder to jump by heading.
- **WCAG:** 1.3.1 (Info and Relationships), 2.4.10 (Section Headings)
- **Recommendation:** Add a single `h1` per route (e.g. visually hidden or in app bar) and use heading levels for main sections (e.g. “Devices”, “Add Screen”).
- **Suggested command:** `/polish` or `/harden`.

#### M2. Theme colors defined with hex (not modern color space)

- **Location:** `packages/ui/src/plugins/vuetify.ts`
- **Category:** Theming
- **Description:** Light/dark theme colors use hex. Frontend-design skill suggests modern CSS (e.g. oklch, color-mix) for consistency and maintainability.
- **Impact:** Purely technical/maintainability; current theme is consistent and matches CLAUDE.md.
- **Recommendation:** Optional: migrate to oklch or design tokens if you want fluid theming or design-system scaling.
- **Suggested command:** `/normalize` (if design system doc specifies tokens).

#### M3. Nested card in DeviceLogsCard expansion

- **Location:** `packages/ui/src/components/DeviceLogsCard.vue` (lines 143–228)
- **Category:** Anti-pattern (layout)
- **Description:** “Device Status” and “Additional Info” are wrapped in `<v-card variant="tonal">` inside expansion panel content. Frontend-design advises against nesting cards.
- **Impact:** Visual hierarchy is slightly heavy; could be a simple bordered/background div.
- **Recommendation:** Replace inner `v-card` with a `div` and tonal background/spacing (e.g. `variant="tonal"` on a non-card container if available, or custom class).
- **Suggested command:** `/distill` or manual simplification.

#### M4. Vuetify default typography (Roboto)

- **Location:** Global (Vuetify default)
- **Category:** Theming / Typography
- **Description:** Frontend-design skill lists Roboto as overused. Project has not customized font family.
- **Impact:** Visual only; supports “minimal” and “tool-first” but not “distinctive” typography.
- **Recommendation:** Optional: choose a different typeface for headings or body if you want to differentiate; otherwise document as intentional.
- **Suggested command:** `/normalize` if design system specifies a font.

---

### Low

#### L1. MAC copy action without dedicated accessible name

- **Location:** `packages/ui/src/components/DeviceInformationCard.vue` (MAC field append icon)
- **Category:** Accessibility
- **Description:** The MAC field uses an append icon (copy) with `@click:append`; the copy action is not explicitly named for assistive tech (e.g. “Copy MAC address”). Label is on the field; the button role may be implied by Vuetify.
- **Impact:** Screen reader users may not get a clear “Copy” action name.
- **Recommendation:** Add `aria-label="Copy MAC address"` to the field or the append slot if Vuetify exposes it; or use a separate icon button with an accessible name.
- **Suggested command:** `/polish`.

#### L2. Maintenance / Virtual Device / HTML Preview routes fetch devices on enter

- **Location:** `packages/ui/src/router/index.ts` (`beforeEnter` for maintenance, virtualDevice, htmlPreview)
- **Category:** Performance (minor)
- **Description:** Maintenance has no device list; Virtual Device and HTML Preview use the device list (e.g. Virtual Device dropdown). Fetching on every enter is consistent but could be skipped for Maintenance.
- **Impact:** One extra store fetch when opening Maintenance; negligible unless API is slow.
- **Recommendation:** Optional: remove `beforeEnter` device fetch for Maintenance only; keep for Virtual Device and HTML Preview.
- **Suggested command:** Manual or `/optimize` if you standardize route data loading.

#### L3. ScreenListCard overlay iframe fixed dimensions

- **Location:** `packages/ui/src/components/ScreenListCard.vue` (line 144)
- **Category:** Responsive
- **Description:** Overlay iframe uses `:width="(device.width || 0) + 5"` and `:height="(device.height || 0) + 5"`. On very small viewports this could exceed the viewport; overlay is typically modal so impact is limited.
- **Impact:** Edge case on small screens if device dimensions are large.
- **Recommendation:** Optionally cap dimensions with `max-width: 100vw` and `max-height: 100vh` (or equivalent) so overlay never overflows.
- **Suggested command:** `/adapt` or `/polish`.

#### L4. Chunk size warning limit at 600 KB

- **Location:** `packages/ui/vite.config.ts` (`chunkSizeWarningLimit: 600`)
- **Category:** Performance
- **Description:** Build is allowed to warn only above 600 KB per chunk. Acceptable for many apps but worth monitoring.
- **Impact:** Large chunks can delay first load if they cross the critical path.
- **Recommendation:** Keep; consider auditing bundle with `vite-bundle-visualizer` or similar if you add heavy deps.
- **Suggested command:** `/optimize` if you do a dedicated perf pass.

---

## Patterns & Systemic Notes

- **Accessibility:** Icon-only buttons and key actions have `aria-label`s; one iframe is missing `title`. Forms use labels and validation. Main gap is semantic headings and the MAC copy name.
- **Theming:** Single source of truth in `vuetify.ts`; `theme-color` meta is updated from App.vue; no hard-coded colors in components.
- **Responsive:** Containers and grids use Vuetify breakpoints; tables use `overflow-x-auto`; iframes use `max-width` and `aspect-ratio`. App bar tabs are the main unknown on narrow viewports.
- **Performance:** Lazy routes, manual chunks (vue, vue-router, pinia, vuetify), opacity-only route transition, and `prefers-reduced-motion` handling are in place.

---

## Positive Findings

- **Navigation:** App bar tabs are present and wired; drawer duplicates nav; route transition is subtle and respects reduced motion.
- **Theme:** Custom light/dark theme with tinted neutrals and semantic colors; no pure black/white; matches “monochrome, e-ink, minimalistic” in CLAUDE.md.
- **Empty states:** Short, actionable copy (e.g. “No devices yet. Add one with the form above.”).
- **Progressive disclosure:** DeviceInformationCard “Advanced” section; DeviceLogsCard “Show Details” per entry; Virtual Device “Response” in an expansion panel.
- **Motion:** Route transition uses opacity and ease-out-quart; reduced motion respected.
- **ARIA:** Nav icon, theme toggle, refresh, edit device name, screen actions, log expand/collapse all have appropriate labels.

---

## Recommendations by Priority

1. **Immediate:** Add `title="HTML preview"` to ScreenListCard overlay iframe (fixes H1).
2. **Short-term:** Verify and, if needed, adjust app bar tabs on narrow viewports (H2). Optionally add semantic headings (M1).
3. **Medium-term:** Consider replacing nested card in DeviceLogsCard (M3); optionally modernize theme tokens (M2) or typography (M4).
4. **Long-term:** Optional MAC copy label (L1), Maintenance route fetch (L2), overlay iframe max dimensions (L3), and bundle monitoring (L4).

---

## Suggested Commands for Fixes

| Issue(s) | Command | Notes |
|----------|---------|--------|
| H1 (iframe title) | `/polish` | Quick a11y fix. |
| H2 (app bar responsive) | `/adapt` | Responsive behavior and testing. |
| M1 (headings) | `/polish` or `/harden` | Semantic structure. |
| M2 (tokens/color) | `/normalize` | If design system uses tokens. |
| M3 (nested card) | `/distill` | Simplify layout. |
| M4 (typography) | `/normalize` | If design system specifies font. |
| L1 (MAC copy) | `/polish` | Accessible name for copy. |
| L2–L4 | Manual or `/optimize` | Optional performance and responsive tweaks. |

---

*This audit documents current state only. No changes were made; use the suggested commands or manual edits to address findings.*
