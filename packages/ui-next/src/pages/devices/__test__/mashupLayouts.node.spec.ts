import { MASHUP_LAYOUTS } from 'kuroshiro-shared'
import { describe, expect, it } from 'vitest'
import { carriedOver, layoutChoice, MASHUP_LAYOUT_CHOICES, withoutSlot } from '../mashupLayouts'

describe('the Mashup layouts as the admin reads them', () => {
  it('names every layout the API knows, in the API\'s order', () => {
    expect(MASHUP_LAYOUT_CHOICES.map(layout => layout.id)).toEqual(MASHUP_LAYOUTS.map(layout => layout.id))
    expect(MASHUP_LAYOUT_CHOICES.map(layout => layout.name)).toEqual([
      'Left and right',
      'Top and bottom',
      'One left, two right',
      'Two left, one right',
      'Two top, one bottom',
      'One top, two bottom',
      'Four quarters',
    ])
  })

  it('names each slot after the position the API gives it, in slot order', () => {
    MASHUP_LAYOUTS.forEach((layout) => {
      const asPositions = layoutChoice(layout.id).slotNames.map(name => name.toLowerCase().replace(' ', '-'))
      expect(asPositions).toEqual(layout.slots.map(slot => slot.position))
    })
    expect(layoutChoice('1Lx2R').slotNames).toEqual(['Left', 'Top right', 'Bottom right'])
    expect(layoutChoice('2x2').slotCount).toBe(4)
  })
})

describe('changing a Mashup\'s layout', () => {
  it('carries the Plugins over by slot order and starts a new slot empty', () => {
    expect(carriedOver(['weather', 'calendar'], '1Lx2R')).toEqual(['weather', 'calendar', null])
  })

  it('names the Plugins a layout with fewer slots has no slot for', () => {
    expect(carriedOver(['weather', 'calendar', 'trains'], '1Tx1B')).toEqual(['weather', 'calendar'])
    expect(withoutSlot(['weather', 'calendar', 'trains'], '1Tx1B')).toEqual(['trains'])
    expect(withoutSlot(['weather', 'calendar'], '2x2')).toEqual([])
  })
})
