import type { RenderSignal } from 'kuroshiro-shared'
import type { MashupSlot } from './entities/mashup-slot.entity.js'
import type { SlotDrawing } from './mashup-page.js'

type SignalledSlot = Pick<MashupSlot, 'renderSignal'>

/**
 * The Render Signal a Mashup raises as a whole once its slots' own are read (ADR-0067):
 * `skip` when every slot skips, `hold` when no slot draws live but not every slot skips,
 * otherwise none, since one live slot is enough to render the Mashup. A slot whose Plugin
 * could not be rendered raises none, so it draws its failed-render drawing like a live one.
 */
export function mashupRenderSignal(slots: SignalledSlot[]): RenderSignal | null {
  if (slots.length === 0 || slots.some(slot => !slot.renderSignal))
    return null
  return slots.every(slot => slot.renderSignal === 'skip') ? 'skip' : 'hold'
}

/**
 * What a slot draws in a Mashup that renders: its markup when live, nothing on `skip`, the
 * markup it last drew live on `hold` (nothing when it has none yet), and the failed-render
 * drawing when its Plugin could not be rendered.
 */
export function slotDrawing(slot: Pick<MashupSlot, 'size' | 'renderedMarkup' | 'liveMarkup' | 'renderSignal' | 'plugin'>): SlotDrawing {
  if (slot.renderedMarkup == null || !slot.renderSignal)
    return renderedSlotDrawing(slot, slot.renderedMarkup ?? null)
  if (slot.renderSignal === 'skip')
    return { size: slot.size, kind: 'empty' }
  if (slot.renderSignal === 'hold')
    return slot.liveMarkup == null ? { size: slot.size, kind: 'empty' } : { size: slot.size, kind: 'markup', markup: slot.liveMarkup }
  return renderedSlotDrawing(slot, slot.renderedMarkup)
}

/** What a slot draws from the markup its Plugin rendered, regardless of any signal: that markup, or the failed-render drawing when it is `null`. */
export function renderedSlotDrawing(slot: Pick<MashupSlot, 'size' | 'plugin'>, markup: string | null): SlotDrawing {
  return markup === null
    ? { size: slot.size, kind: 'failed', pluginName: slot.plugin.name }
    : { size: slot.size, kind: 'markup', markup }
}
