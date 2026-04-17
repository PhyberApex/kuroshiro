# Kuroshiro UI — Design Critique

**Date:** March 2025  
**Scope:** App shell, Overview, Device Details, and design system (theme, components, copy)  
**Reference:** CLAUDE.md (monochrome, e-ink, minimalistic), frontend-design skill DON'Ts

---

## Anti-Patterns Verdict

**Verdict: Pass (with one caveat).**

The interface does **not** read as obvious “AI slop.” It avoids the usual tells:

| DON'T (frontend-design) | Status |
|--------------------------|--------|
| AI color palette (cyan-on-dark, purple–blue gradients, neon on dark) | **Avoided** — Tinted neutrals and semantic-only color. |
| Gradient text on headings/metrics | **Avoided** — No gradient text. |
| Dark mode with glowing accents | **Avoided** — Dark theme uses muted semantic colors. |
| Glassmorphism, blur, glow borders | **Avoided** — Flat, elevation-1 cards. |
| Hero metric layout (big number + small label + gradient) | **Avoided** — No hero metrics. |
| Identical card grids (icon + heading + text, repeated) | **Mostly avoided** — Cards have distinct roles (form, list, info, screens). Some repetition in “card + title + divider + content” but not the worst pattern. |
| Pure black / pure white | **Avoided** — Tinted neutrals (#17181a, #fafbfc, etc.). |
| Gray text on colored backgrounds | **Avoided** — text-medium-emphasis and theme tokens. |
| Large icons above every heading | **Avoided** — No decorative icons on section titles. |
| Bounce/elastic easing | **Avoided** — No custom motion that would use it. |
| Redundant headers / intros that restate the heading | **Addressed** — Intro cards removed in distill. |

**Caveat:** Vuetify’s default typography (e.g. Roboto) is in the “overused fonts” list. The shell still feels like “Vuetify + minimal theme” rather than a strongly unique visual identity. For a **tool** with a stated “minimal, nerdy” brand, that’s acceptable; for a flagship product you’d want a more distinctive type choice.

**The test:** If you said “AI made this,” someone might say “maybe” because of the generic font and Material-style layout—but not “obviously” because of the restrained palette, no gradients, and intentional monochrome. So: **pass, with room to be more distinctive.**

---

## Overall Impression

**What works:** The UI is coherent, on-brand (monochrome, e-ink, minimal), and legible. Primary actions (Add Device, Update, Add Screen) are clear. Empty states and copy guide users. Tinted neutrals and semantic color are used with purpose.

**What doesn’t:** The app bar is busy (title + subtitle + four tabs + theme toggle). Device detail is dense and slightly even in visual weight. Layout is centered everywhere, so it feels safe rather than intentionally composed. Typography is default Vuetify and doesn’t reinforce “nerdy” or “e-ink” in a memorable way.

**Biggest opportunity:** Sharpen hierarchy and one clear “hero” action per screen (e.g. “Add Device” on Overview, “Add Screen” on Device Detail), and optionally introduce a single, restrained type choice that supports the brand without breaking the minimal rule.

---

## What's Working

1. **Restrained, purposeful color**  
   Tinted neutrals and semantic color only for status (success/error/warning/info) match the “monochrome, e-ink, minimalistic” direction. No decorative color. Palette is consistent and supports clarity instead of noise.

2. **Clear primary actions and feedback**  
   “Add Device,” “Update,” “Add Screen” are easy to find. Buttons use primary/tonal/error consistently. Loading and disabled states are present. Validation and empty states point to the next step. The interface behaves like a control panel, not a brochure.

3. **Progressive disclosure and structure**  
   Device detail keeps advanced options (mirroring, refresh rate, special functions) in context without a wall of controls. Empty states explain what will appear and what to do. No redundant intro cards. Information is grouped in a way that fits the job (devices → device → screens, logs, settings).

---

## Priority Issues

### 1. App bar is crowded; hierarchy is flat

**What:** Title (“Kuroshiro v0.7.0 — TRMNL server implementation”), four tabs, and theme toggle sit in one bar. Everything has similar visual weight.

**Why it matters:** The bar is the first thing users see. Too many elements of similar importance make the shell feel busy and dilute focus. Technical users still benefit from a clear “where I am” and “what I do next.”

**Fix:** Shorten or simplify the title (e.g. “Kuroshiro” + version only; move “TRMNL server implementation” to footer or about). Consider moving two of the four tabs into the drawer (e.g. keep Overview + one other in the bar, rest in drawer) so the bar has one primary nav concept. Ensure one element (e.g. current section or main CTA) reads as slightly dominant.

**Command:** `/distill` (simplify shell) or manual layout/hierarchy pass.

---

### 2. Centered layout everywhere

**What:** Main content uses `v-row justify="center"` and centered tabs. All views are center-aligned.

**Why it matters:** Frontend-design: “Don’t center everything—left-aligned text with asymmetric layouts feels more designed.” Centering everything can feel like a default template and doesn’t create a strong compositional identity.

**Fix:** Use left-aligned content where it helps (e.g. device list, form blocks). Reserve center for true focal points (e.g. empty state message). Consider a max-width container with left alignment and consistent side margins instead of centering the whole content block.

**Command:** Manual layout tweaks or `/polish` with a focus on alignment and grid.

---

### 3. Device detail page density and visual weight

**What:** Device detail packs Device Info, Current Screen, Add Screen, Screens list, and Logs into a 7/5 column layout. All cards use the same elevation and similar titles.

**Why it matters:** Dense is OK for a tool, but when every card has the same weight, “Update” and “Add Screen” don’t stand out as the main things to do. Scanning cost goes up.

**Fix:** Slightly differentiate the “primary” card (e.g. Add Screen or device header) with a bit more emphasis (e.g. position, spacing, or a single subtle border) without adding decoration. Keep one obvious “primary action” per section. Consider order: device header + primary action first, then supporting blocks (screens list, logs).

**Command:** `/polish` (hierarchy and spacing) or manual pass on Device Details layout.

---

### 4. Typography is default Vuetify

**What:** Font stack is almost certainly Roboto or the default Material set—common and “overused” in the frontend-design sense.

**Why it matters:** For “minimal, nerdy, e-ink,” a single, deliberate type choice (e.g. a clear sans or a technical-but-readable font) would reinforce the brand and make the UI feel more intentional rather than framework-default.

**Fix:** Pick one font that fits “minimal, nerdy, e-ink” (e.g. IBM Plex Sans, JetBrains Mono for code-only bits, or a sharp sans). Use it consistently for UI and, if desired, for code/IDs. Keep weights and sizes minimal (e.g. 2–3 weights, clear hierarchy). Don’t overdo it—one family is enough.

**Command:** Manual theme/typography update (and document in DESIGN-SYSTEM.md). Not a skill command; a small design decision.

---

### 5. No motion or transition language

**What:** Route changes and panel toggles (e.g. drawer, expansion panels) have no defined motion. Content appears/disappears without transition.

**Why it matters:** Frontend-design favors motion that conveys state change and hierarchy. A little structure (e.g. short fade or slide on route change, consistent expansion) would make the app feel more polished and easier to follow.

**Fix:** Add short, subtle transitions (e.g. 150–200 ms, ease-out) for route views and for drawer open/close. Use CSS/transform/opacity only. Keep expansion panels to their default if they already animate; if not, add a simple open/close transition. Respect `prefers-reduced-motion`.

**Command:** `/animate` (if available) or manual transition design + implementation.

---

## Minor Observations

- **Demo banner:** Warning color and short copy are good; consider a dismiss option so returning users can hide it.
- **Tabs on small screens:** Four tabs in the app bar may wrap or feel tight on narrow viewports; test and consider collapsing to icon + “More” or moving some into the drawer.
- **“Devices” in drawer:** When there are no devices, the drawer shows “No devices yet” with subtitle “Add one from Overview.” That’s clear; ensure the same logic is obvious when there are many devices (e.g. scroll or grouping).
- **Screen list table:** Dense table with Type / Filename / Status / Actions is fine for technical users; ensure horizontal scroll and touch targets on small screens (already improved with overflow-x-auto).

---

## Questions to Consider

1. **What if the app bar had only “Kuroshiro” + current section, with everything else in the drawer?** Would that make the shell calmer and the main content more prominent?
2. **Does Device Detail need to show all five blocks at once?** Could “Add Screen” be the hero, with “Screens” and “Logs” as secondary (e.g. tabs or collapsible sections)?
3. **What would “confident minimal” look like?** e.g. More whitespace, one big primary action, and fewer but clearer secondary actions.
4. **Is the current typeface helping or just neutral?** If you swapped in one deliberate font (e.g. IBM Plex Sans), would it feel more “Kuroshiro” and less “default Vuetify”?
5. **Who lands on Overview with zero devices?** The empty state is good; is there anything else (e.g. one-sentence value line or a single CTA) that would make the first 10 seconds even clearer?

---

## Summary

The UI **passes** the AI-slop check and aligns with the stated **monochrome, e-ink, minimalistic** direction. Color and structure are purposeful; primary actions and empty states work. The main gaps are **hierarchy** (busy app bar, even weight on device detail), **layout** (everything centered), **typography** (default, not distinctive), and **motion** (none defined). Addressing those in order—shell and device-detail hierarchy first, then alignment, then type and motion—would make the interface feel more intentional and “designed” without losing its minimal, tool-first character.
