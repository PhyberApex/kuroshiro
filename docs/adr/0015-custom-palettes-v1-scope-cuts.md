# Custom palettes v1 scope cuts

Grilling issue #783 deliberately cut the following from v1:

- **No grayscale or full-color custom authoring.** Custom palettes are restricted to the 5 colour families (`color-3bwr`, `color-3bwy`, `color-4bwry`, `color-6a`, `color-7a`). Under this design's constraints (fixed `frameworkClass` families, grayscale locked to its canonical computed levels, full-color having no palette at all — ADR-0014), a "custom" grayscale or full-color entry would be byte-for-byte identical to the existing official palette of that family. Only the colour families have a genuinely free parameter — the `colors` array.
- **No delete guard.** Deleting a custom palette that's still assigned to a Device relies on the existing `Device.palette` `SET NULL` FK, same as any other FK in the codebase — the Device silently falls back to `defaultPaletteFor(model)`, matching the existing behaviour for a Device with no palette set at all. This is a deliberate asymmetry from official palettes, which are never hard-deleted (sync only flips `deprecated: true`) — custom palettes are admin-owned and admin-deletable by design.
- **No per-Screen / per-playlist-item palette override.** Reconfirms ADR-0008's existing deferral: palette is a rendering concern attached at the Device level, not a Schedule/eligibility concern. Still blocked on the separate Screen Playlists work landing a concrete Screen-level rendering hook to attach an override to.

## Consequences

- A future "custom grayscale palette" request should be treated as a signal the family-based authoring constraint (ADR-0014) needs revisiting, not as a simple additive feature — there's currently nothing distinct to store.
- A per-Screen override, when built, is additive on top of this design — it doesn't require reshaping how custom palettes are authored or how compatibility is derived.
