import type { PreviewData, ScreenShellTarget, TemplateProblem, TemplateSize } from 'kuroshiro-shared'
import { checkTemplate, MASHUP_LAYOUTS, renderLiquid, templateProblemOf, viewFull, wrapInScreenShell } from 'kuroshiro-shared'

/**
 * The browser's render of a Template, and the one module of the admin UI that holds the Liquid engine: the Template
 * section fetches it with `import()`, so the engine is in no page's first load (`scripts/firstLoad.ts`).
 */

export { checkTemplate, KUROSHIRO_FILTERS } from 'kuroshiro-shared'

export interface PreviewInput {
  markup: string
  size: TemplateSize
  /** What Liquid reads: the data the server would render with. */
  context: PreviewData['context']
  target: ScreenShellTarget
}

export type PreviewOutcome
  = | { document: string }
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
export async function previewOf({ markup, size, context, target }: PreviewInput): Promise<PreviewOutcome> {
  const unparsed = checkTemplate(markup)
  if (unparsed)
    return { problem: unparsed, stopsSave: true }
  try {
    return { document: wrapInScreenShell(target, bodyOf(size, await renderLiquid(markup, context))) }
  }
  catch (error) {
    return { problem: templateProblemOf(error), stopsSave: false }
  }
}
