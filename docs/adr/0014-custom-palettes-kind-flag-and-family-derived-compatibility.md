# Custom palettes are `kind`-flagged rows with generated IDs and family-derived compatibility

`Palette` gains a `kind: 'official' | 'custom'` column. The daily sync job (`device-model-sync.service.ts`) only ever upserts or deprecates `kind: 'official'` rows; custom rows are written solely through admin CRUD and are never touched by sync. This is necessary because sync upserts by `id`, and without a discriminator a future upstream ID could collide with — or the deprecate-if-missing pass could wrongly touch — an admin-created row.

Custom palette IDs are opaque and generated (nanoid), not human-chosen slugs like the official palettes' TRMNL-sourced IDs (`bw`, `gray-16`, …). This trades away a readable ID in exchange for making collision with a future upstream ID structurally impossible; `name` remains the human-facing label.

Device-model compatibility for a custom palette is derived automatically from the colour family (see ADR-0015) it belongs to, rather than stored as an explicit per-model list. `DeviceModel.paletteIds` — the mechanism official palettes use — is wholesale overwritten from the upstream payload on every sync (`trmnl-payloads.ts`), so it cannot safely hold a custom palette's ID without a sync-ordering bug wiping it. `applyModelChanges`'s validation branches: membership in `paletteIds` for `kind: 'official'`, family-match against the target Device Model's `frameworkClass` for `kind: 'custom'`.

A custom palette's `colors` array is arbitrary length, pre-filled with its family's official colours as a starting point but freely editable — not locked to the family's canonical count. The firmware classifies each dithered pixel independently by RGB threshold against its fixed physical ink colours (ADR-0002), rather than matching against the PNG palette's length, so there's no structural reason to enforce count parity.

## Consequences

- Deriving compatibility by family instead of reusing TRMNL's curated `paletteIds` bypasses per-model curation — including firmware colour-matching ADR-0002 found still unverified for `color-3bwr` and `color-7a`. An admin can assign a custom palette in either family to any device model in that family without that caveat surfacing.
- Colours landing outside a family's firmware threshold bands may misclassify on real hardware; this isn't validated server-side, only worth surfacing as a UI hint.
