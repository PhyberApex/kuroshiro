export const RENDER_FAILED = Symbol('render failed')
/** A `skip` Render Signal observed while honouring it: the Screen is left out of Rotation, its stored image untouched. */
export const RENDER_SKIPPED = Symbol('render skipped')
/** A `hold` Render Signal observed while honouring it: the screenshot is discarded, the Screen's stored image untouched. */
export const RENDER_HELD = Symbol('render held')

/** A rendered image's URL, `null` when the Screen has nothing to render from, or `RENDER_FAILED`/`RENDER_SKIPPED`/`RENDER_HELD`. */
export type RenderOutcome = string | null | typeof RENDER_FAILED | typeof RENDER_SKIPPED | typeof RENDER_HELD
