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
- `offset_x`/`offset_y` describe a panel whose visible area starts inset from the top-left of its (rotated) frame — e.g. a Kindle behind bezel chrome. Conversion resizes/extends to the model's unrotated `width`x`height`, rotates, then crops the offset off the top-left and re-extends to the full rotated canvas (`gravity NorthWest`, background white), so the output always equals the model's rotated dimensions instead of shrinking by the offset. Only `amazon_kindle_2024` has a non-zero offset upstream as of this writing; see #751.
  Checked `usetrmnl/terminus` (`app/aspects/screens/mold.rb`, `converters/monochrome.rb`/`color.rb`) while deciding this. Its pipeline order differs from ours — it rotates the raw input first, then force-resizes (ImageMagick `!`, no letterbox) to exactly `width`x`height`, so its target canvas is the model's dimensions as given and never swaps for rotation. It then applies an explicit-size crop, `-crop widthxheight+offset_x+offset_y`, at the offset on a canvas already exactly that size — out of bounds whenever the offset is non-zero, which ImageMagick clips to the overlap instead of padding. For `amazon_kindle_2024` that's 1325x815, the same class of undersized result this issue reports, so terminus's own behaviour isn't a semantics reference worth matching. We keep our existing pipeline order (letterbox-fit resize, then rotate — which is what makes the rotated dimensions the correct final size here) and fix only the offset step: crop the offset off the top-left, then re-extend to the full rotated canvas instead of leaving it shrunk.
