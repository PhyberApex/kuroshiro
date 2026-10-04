import { describe, expect, it } from 'vitest'
import { drawLayout } from '../layoutDrawing'

describe('drawLayout', () => {
  it('draws one left, two right as a full-height left half and two stacked right quarters', () => {
    expect(drawLayout('1Lx2R', 3)).toEqual([
      { x: 1, y: 1, width: 29, height: 34 },
      { x: 30, y: 1, width: 29, height: 17 },
      { x: 30, y: 18, width: 29, height: 17 },
    ])
  })

  it('draws two top, one bottom as two top quarters over a full-width bottom half', () => {
    expect(drawLayout('2Tx1B', 3)).toEqual([
      { x: 1, y: 1, width: 29, height: 17 },
      { x: 30, y: 1, width: 29, height: 17 },
      { x: 1, y: 18, width: 58, height: 17 },
    ])
  })

  it.each([
    ['1Lx1R', 2],
    ['1Tx1B', 2],
    ['1Lx2R', 3],
    ['2Lx1R', 3],
    ['2Tx1B', 3],
    ['1Tx2B', 3],
    ['2x2', 4],
  ])('fills the whole Screen with the %s layout\'s %i slots', (id, slotCount) => {
    const slots = drawLayout(id, slotCount)

    expect(slots).toHaveLength(slotCount)
    expect(slots.reduce((area, slot) => area + slot.width * slot.height, 0)).toBe(58 * 34)
  })

  it('draws a layout it does not know as its slots side by side', () => {
    expect(drawLayout('3x1', 3).map(slot => slot.height)).toEqual([34, 34, 34])
    expect(drawLayout('3x1', 3).map(slot => Math.round(slot.x))).toEqual([1, 20, 40])
  })
})
