# Kuroshiro — AI context

## Design Context

### Users
- **Who**: Technical users of an **open-source** project—self-hosters, tinkerers, developers—running their own TRMNL **e-ink display** server. Not aimed at general consumers.
- **Context**: Adding devices, managing screens, viewing device status (battery, WiFi, firmware), and optionally mirroring from the official TRMNL server. Virtual Device and HTML Preview for testing.
- **Job to be done**: Reliably manage TRMNL e-ink devices and screens with a clear, efficient interface that stays out of the way. The UI should feel minimal, trustworthy, and built for technical people.

### Brand Personality
- **Voice**: Clear, direct, and slightly nerdy. Helpful without being flashy. Professional but not corporate.
- **Emotional goals**: Confidence (your data, your controls), clarity (status and actions are obvious), “this just works” without clutter.
- **3-word personality**: **Monochrome, e-ink, minimalistic.**

### Aesthetic Direction
- **Foundation**: Vue 3 + Vuetify. **Minimal and nerdy**—lean on structure and typography, not decoration. **Monochrome-first** with e-ink in mind: grays, black/white, restrained use of color only where it conveys meaning (e.g. status).
- **Current patterns**: Card-based layouts, tonal/text variants, compact density, fluid containers, responsive grids. Prefer grayscale and subtle contrast; use semantic color (success/error/warning) sparingly and only for status.
- **References**: E-ink aesthetic (high contrast, minimal palette), terminal/dev-tool clarity, minimal dashboards. “Modern, intuitive” per README.
- **Anti-references**: No cluttered dashboards, no heavy decoration, no consumer-fluffy or marketing-heavy UI. Avoid unnecessary color and visual noise.

### Design Principles
1. **Minimal and nerdy** — Few elements, clear hierarchy, no decorative fluff. Feels like a tool for technical users, not a product pitch.
2. **Monochrome / e-ink mindset** — Default to grayscale and high contrast. Use color only when it carries meaning (e.g. online/offline, errors). Light and dark mode both supported.
3. **Clarity over cleverness** — Status, actions, and navigation should be immediately scannable. Consistent, minimal use of semantic color.
4. **Progressive disclosure** — Keep main flows simple; tuck advanced options (mirroring, refresh rate, special functions) in context so they’re available but not noisy.
5. **Tool-first** — The UI is a control panel for TRMNL. Prioritize scannable lists, clear actions, and reliable feedback (loading, validation, banners) over visual flair.

---

*This design context guides all UI/UX decisions. Update it when brand or product direction changes.*
