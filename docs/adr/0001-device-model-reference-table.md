# Device Models are a synced reference table and the source of truth for rendering

Devices running the TRMNL firmware come in many panel sizes, colour depths and orientations, and the firmware reports both a board name (`Model` header) and raw `Width`/`Height`. We render each Device against a **Device Model** — a read-only reference table synced from `usetrmnl.com/api/models` (and `/api/palettes`), seeded from a bundled snapshot so a self-hosted instance works offline — rather than against the reported dimensions or a hand-maintained list. The model row (dimensions, CSS classes/variables, rotation, offsets, palettes) is the single source of truth for viewport, markup and image conversion; the reported `Width`/`Height` are telemetry only, used to pick a model when the board name is unknown and to flag a mismatch afterwards.

## Considered options

- **Reported `Width`/`Height` as the truth** (previous behaviour). Rejected: TRMNL's `plugins.css` sizes and scales content per model class, so rendering needs a coherent bundle of CSS variables, pixel ratio and rotation that dimensions alone don't provide.
- **Hardcoded model list in the repo only.** Rejected: upstream adds models faster than we'd track; kept only as the offline seed.
- **User-editable models.** Deferred: the upstream list already covers generic BYOD panels; the schema leaves room for a `source` column if custom models are ever needed.

## Consequences

- Header-based model resolution runs only while a Device has no model; a manual assignment is never overridden by later headers (a mismatch is surfaced in the UI instead).
- Synced models that disappear upstream are flagged deprecated, never deleted, so no Device silently loses its rendering configuration.
- The Palette is chosen per Device from the model's allowed list and decides the output bit depth; the model decides everything else.
- Output is PNG only regardless of the model's `mime_type`.
