import type { Screen } from '../../screens/screens.entity'
import { describe, expect, it } from 'vitest'
import { MashupConfiguration } from '../entities/mashup-configuration.entity'
import { MashupSlot } from '../entities/mashup-slot.entity'

describe('mashupConfiguration entity', () => {
  it('should create a mashup configuration with required fields', () => {
    const config = new MashupConfiguration()
    config.id = 'test-id'
    config.layout = '2x2'

    expect(config.id).toBe('test-id')
    expect(config.layout).toBe('2x2')
  })

  it('should support all valid layout types', () => {
    const validLayouts = ['1Lx1R', '1Tx1B', '1Lx2R', '2Lx1R', '2Tx1B', '1Tx2B', '2x2']

    validLayouts.forEach((layout) => {
      const config = new MashupConfiguration()
      config.layout = layout
      expect(config.layout).toBe(layout)
    })
  })

  it('should have screen relationship', () => {
    const config = new MashupConfiguration()
    const mockScreen = { id: 'screen-1' } as Screen

    config.screen = mockScreen

    expect(config.screen).toBeDefined()
    expect(config.screen.id).toBe('screen-1')
  })

  it('should have slots relationship', () => {
    const config = new MashupConfiguration()
    const slot1 = new MashupSlot()
    slot1.id = 'slot-1'
    const slot2 = new MashupSlot()
    slot2.id = 'slot-2'

    config.slots = [slot1, slot2]

    expect(config.slots).toHaveLength(2)
    expect(config.slots[0].id).toBe('slot-1')
    expect(config.slots[1].id).toBe('slot-2')
  })

  it('should have timestamps', () => {
    const config = new MashupConfiguration()
    const now = new Date()

    config.createdAt = now
    config.updatedAt = now

    expect(config.createdAt).toBe(now)
    expect(config.updatedAt).toBe(now)
  })
})
