import { MASHUP_SLOT_ERROR_STYLE, mashupSlotErrorHtml } from './mashup-slot-error-template.js'

/** What one slot draws in its box of a Mashup's page: its Plugin's markup, the failed-render drawing, or nothing. */
export type SlotDrawing
  = | { size: string, kind: 'markup', markup: string }
    | { size: string, kind: 'failed', pluginName: string }
    | { size: string, kind: 'empty' }

/** A Mashup's body markup: one `.view` box per slot drawing, in the order given, inside the layout's `.mashup` element. */
export function mashupPageHtml(layout: string, drawings: SlotDrawing[]): string {
  const viewsHtml = drawings.map(drawing =>
    `<div class="view ${drawing.size}">${slotHtml(drawing)}</div>`,
  ).join('\n    ')
  const style = drawings.some(drawing => drawing.kind === 'failed') ? `<style>${MASHUP_SLOT_ERROR_STYLE}</style>` : ''

  return `${style}<div class="mashup mashup--${layout}">
    ${viewsHtml}
    </div>`
}

function slotHtml(drawing: SlotDrawing): string {
  switch (drawing.kind) {
    case 'markup': return drawing.markup
    case 'failed': return mashupSlotErrorHtml(drawing.pluginName)
    case 'empty': return ''
  }
}
