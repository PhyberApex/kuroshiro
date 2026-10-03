import { MASHUP_LAYOUTS } from 'kuroshiro-shared'

export interface SlotConfig {
  position: string
  size: string
  order: number
}

export interface LayoutConfig {
  [layout: string]: SlotConfig[]
}

export const MASHUP_LAYOUT_IDS: string[] = MASHUP_LAYOUTS.map(layout => layout.id)

/** The shared layouts as a Mashup slot stores them: the size as its CSS class, the slot order as a number. */
export const MASHUP_LAYOUT_CONFIG: LayoutConfig = Object.fromEntries(MASHUP_LAYOUTS.map(layout => [
  layout.id,
  layout.slots.map((slot, order) => ({ position: slot.position, size: `view--${slot.size}`, order })),
]))
