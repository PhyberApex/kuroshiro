import type { MashupLayout } from 'kuroshiro-shared'
import type { PickableLayout } from '@/components/LayoutPicker.vue'
import { MASHUP_LAYOUTS } from 'kuroshiro-shared'

/** The layouts and their slots as `docs/ui/devices.md` names them, slots in slot order. */
const LAYOUT_WORDING: Record<MashupLayout, { name: string, slotNames: string[] }> = {
  '1Lx1R': { name: 'Left and right', slotNames: ['Left', 'Right'] },
  '1Tx1B': { name: 'Top and bottom', slotNames: ['Top', 'Bottom'] },
  '1Lx2R': { name: 'One left, two right', slotNames: ['Left', 'Top right', 'Bottom right'] },
  '2Lx1R': { name: 'Two left, one right', slotNames: ['Top left', 'Bottom left', 'Right'] },
  '2Tx1B': { name: 'Two top, one bottom', slotNames: ['Top left', 'Top right', 'Bottom'] },
  '1Tx2B': { name: 'One top, two bottom', slotNames: ['Top', 'Bottom left', 'Bottom right'] },
  '2x2': { name: 'Four quarters', slotNames: ['Top left', 'Top right', 'Bottom left', 'Bottom right'] },
}

export interface MashupLayoutChoice extends PickableLayout {
  id: MashupLayout
  slotNames: string[]
}

/** Every layout a Mashup can have, in the API's order, for the Layout picker and the slot selects. */
export const MASHUP_LAYOUT_CHOICES: MashupLayoutChoice[] = MASHUP_LAYOUTS.map(({ id, slots }) => ({
  id,
  slotCount: slots.length,
  ...LAYOUT_WORDING[id],
}))

export function layoutChoice(id: MashupLayout) {
  return MASHUP_LAYOUT_CHOICES.find(layout => layout.id === id)!
}

/** The Plugins of a Mashup under another layout: carried over by slot order, a new slot empty. */
export function carriedOver(pluginIds: (string | null)[], layout: MashupLayout): (string | null)[] {
  return Array.from({ length: layoutChoice(layout).slotCount }, (_, slot) => pluginIds[slot] ?? null)
}

/** The Plugins a layout with fewer slots has no slot for. */
export function withoutSlot(pluginIds: (string | null)[], layout: MashupLayout) {
  return pluginIds.slice(layoutChoice(layout).slotCount).flatMap(id => id ?? [])
}

/** The placed Plugins with one of them in a slot. A Plugin fills one slot at most, so it leaves the slot it was in. */
export function placedIn(placed: (string | null)[], slot: number, pluginId: string): (string | null)[] {
  const elsewhere = placed.map(held => held === pluginId ? null : held)
  return Array.from({ length: Math.max(elsewhere.length, slot + 1) }, (_, index) => index === slot ? pluginId : elsewhere[index] ?? null)
}
