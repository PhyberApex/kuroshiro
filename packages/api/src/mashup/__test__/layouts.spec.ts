import { describe, expect, it } from 'vitest'
import { MASHUP_LAYOUT_CONFIG } from '../constants/layouts.js'

describe('the Mashup layouts as slots store them', () => {
  it('keeps every layout\'s slots in slot order, with the size as its CSS class', () => {
    expect(MASHUP_LAYOUT_CONFIG).toEqual({
      '1Lx1R': [
        { position: 'left', size: 'view--half_vertical', order: 0 },
        { position: 'right', size: 'view--half_vertical', order: 1 },
      ],
      '1Tx1B': [
        { position: 'top', size: 'view--half_horizontal', order: 0 },
        { position: 'bottom', size: 'view--half_horizontal', order: 1 },
      ],
      '1Lx2R': [
        { position: 'left', size: 'view--half_vertical', order: 0 },
        { position: 'top-right', size: 'view--quadrant', order: 1 },
        { position: 'bottom-right', size: 'view--quadrant', order: 2 },
      ],
      '2Lx1R': [
        { position: 'top-left', size: 'view--quadrant', order: 0 },
        { position: 'bottom-left', size: 'view--quadrant', order: 1 },
        { position: 'right', size: 'view--half_vertical', order: 2 },
      ],
      '2Tx1B': [
        { position: 'top-left', size: 'view--quadrant', order: 0 },
        { position: 'top-right', size: 'view--quadrant', order: 1 },
        { position: 'bottom', size: 'view--half_horizontal', order: 2 },
      ],
      '1Tx2B': [
        { position: 'top', size: 'view--half_horizontal', order: 0 },
        { position: 'bottom-left', size: 'view--quadrant', order: 1 },
        { position: 'bottom-right', size: 'view--quadrant', order: 2 },
      ],
      '2x2': [
        { position: 'top-left', size: 'view--quadrant', order: 0 },
        { position: 'top-right', size: 'view--quadrant', order: 1 },
        { position: 'bottom-left', size: 'view--quadrant', order: 2 },
        { position: 'bottom-right', size: 'view--quadrant', order: 3 },
      ],
    })
    expect(Object.keys(MASHUP_LAYOUT_CONFIG)).toEqual(['1Lx1R', '1Tx1B', '1Lx2R', '2Lx1R', '2Tx1B', '1Tx2B', '2x2'])
  })
})
