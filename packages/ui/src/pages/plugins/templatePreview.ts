import type { PreviewData, ScreenModifiers, ScreenShellTarget, TemplateProblem, TemplateSize } from 'kuroshiro-shared'
import { checkTemplate, effectiveFrameworkVersion, MASHUP_LAYOUTS, renderLiquid, templateProblemOf, TRMNL_FRAMEWORK_VERSION, viewFull, wrapInScreenShell } from 'kuroshiro-shared'

/**
 * The browser's render of a Template, and the one module of the admin UI that holds the Liquid engine: the Template
 * section fetches it with `import()`, so the engine is in no page's first load (`scripts/firstLoad.ts`).
 */

export { checkTemplate, KUROSHIRO_FILTERS, TRMNL_FILTERS } from 'kuroshiro-shared'

export interface PreviewInput {
  markup: string
  size: TemplateSize
  /** What Liquid reads: the data the server would render with. */
  context: PreviewData['context']
  target: ScreenShellTarget
  /** The Instance Time Zone (IANA), the zone the server renders dates in, so the preview shows the hour the Device will. */
  timeZone: string
  /** The Plugin's own Framework Version, or null for the Instance's. Only the full size draws with it; a slot size is drawn as in a Mashup, with the Instance's (ADR-0041). */
  frameworkVersion?: string | null
  /** The Plugin's screen modifiers (ADR-0054), drawn on the full size as on its own Screen; a slot size is drawn as in a Mashup, with none. */
  screenModifiers?: ScreenModifiers
}

export type PreviewOutcome
  = | { document: string, /** The body alone, what a device preview request sends (ADR-0040): `document` without the screen shell. */ body: string }
    /** `stopsSave`: the Template does not parse. One that parses and fails against this data may render with the next. */
    | { problem: TemplateProblem, stopsSave: boolean }

/** The Mashup a slot size is drawn in: the layout made of that size alone, the Template in its first slot. */
function layoutOf(size: Exclude<TemplateSize, 'full'>) {
  return MASHUP_LAYOUTS.find(layout => layout.slots.every(slot => slot.size === size))!
}

/** The body the server puts in the screen shell: the full view, or the Mashup with the Template in its own slot and the others empty. */
function bodyOf(size: TemplateSize, html: string) {
  if (size === 'full')
    return viewFull(html)
  const { id, slots } = layoutOf(size)
  const views = slots.map((slot, index) => `<div class="view view--${slot.size}">${index === 0 ? html : ''}</div>`)
  return `<div class="mashup mashup--${id}">${views.join('')}</div>`
}

/** The document the plate draws for a Template, or why there is none. */
export async function previewOf({ markup, size, context, target, frameworkVersion, timeZone, screenModifiers }: PreviewInput): Promise<PreviewOutcome> {
  const unparsed = checkTemplate(markup)
  if (unparsed)
    return { problem: unparsed, stopsSave: true }
  try {
    const body = bodyOf(size, await renderLiquid(markup, context, { timeZone }))
    return { document: wrapInScreenShell(target, body, size === 'full' ? effectiveFrameworkVersion(frameworkVersion) : TRMNL_FRAMEWORK_VERSION, size === 'full' ? screenModifiers : undefined), body }
  }
  catch (error) {
    return { problem: templateProblemOf(error), stopsSave: false }
  }
}
