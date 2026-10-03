/** A slot's place on the drawing as `[x, y, width, height]`, in halves of the Screen. */
type SlotPlace = readonly [number, number, number, number]

const LEFT: SlotPlace = [0, 0, 1, 2]
const RIGHT: SlotPlace = [1, 0, 1, 2]
const TOP: SlotPlace = [0, 0, 2, 1]
const BOTTOM: SlotPlace = [0, 1, 2, 1]
const TOP_LEFT: SlotPlace = [0, 0, 1, 1]
const TOP_RIGHT: SlotPlace = [1, 0, 1, 1]
const BOTTOM_LEFT: SlotPlace = [0, 1, 1, 1]
const BOTTOM_RIGHT: SlotPlace = [1, 1, 1, 1]

/** How each known Mashup layout arranges its slots, in slot order. Which layouts exist is the caller's data, not this table. */
const ARRANGEMENTS: Record<string, readonly SlotPlace[]> = {
  '1Lx1R': [LEFT, RIGHT],
  '1Tx1B': [TOP, BOTTOM],
  '1Lx2R': [LEFT, TOP_RIGHT, BOTTOM_RIGHT],
  '2Lx1R': [TOP_LEFT, BOTTOM_LEFT, RIGHT],
  '2Tx1B': [TOP_LEFT, TOP_RIGHT, BOTTOM],
  '1Tx2B': [TOP, BOTTOM_LEFT, BOTTOM_RIGHT],
  '2x2': [TOP_LEFT, TOP_RIGHT, BOTTOM_LEFT, BOTTOM_RIGHT],
}

function columns(slotCount: number): SlotPlace[] {
  return Array.from({ length: slotCount }, (_, slot) => [slot * 2 / slotCount, 0, 2 / slotCount, 2] as const)
}

export const DRAWING = { width: 60, height: 36, stroke: 1.5 } as const

const INSET = 1
const HALF_WIDTH = (DRAWING.width - 2 * INSET) / 2
const HALF_HEIGHT = (DRAWING.height - 2 * INSET) / 2

export interface SlotRect {
  x: number
  y: number
  width: number
  height: number
}

/** One rectangle per slot. A layout this table does not know is drawn as that many columns. */
export function drawLayout(id: string, slotCount: number): SlotRect[] {
  return (ARRANGEMENTS[id] ?? columns(slotCount)).map(([x, y, width, height]) => ({
    x: INSET + x * HALF_WIDTH,
    y: INSET + y * HALF_HEIGHT,
    width: width * HALF_WIDTH,
    height: height * HALF_HEIGHT,
  }))
}
