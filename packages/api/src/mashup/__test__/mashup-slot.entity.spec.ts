import type { Plugin } from '../../plugins/entities/plugin.entity'
import { describe, expect, it } from 'vitest'
import { MashupConfiguration } from '../entities/mashup-configuration.entity'
import { MashupSlot } from '../entities/mashup-slot.entity'

describe('mashupSlot entity', () => {
  it('should create a mashup slot with required fields', () => {
    const slot = new MashupSlot()
    slot.id = 'slot-id'
    slot.position = 'top-left'
    slot.size = 'view--quadrant'
    slot.order = 0

    expect(slot.id).toBe('slot-id')
    expect(slot.position).toBe('top-left')
    expect(slot.size).toBe('view--quadrant')
    expect(slot.order).toBe(0)
  })

  it('should support all view size classes', () => {
    const validSizes = ['view--full', 'view--half_vertical', 'view--half_horizontal', 'view--quadrant']

    validSizes.forEach((size) => {
      const slot = new MashupSlot()
      slot.size = size
      expect(slot.size).toBe(size)
    })
  })

  it('should have plugin relationship', () => {
    const slot = new MashupSlot()
    const mockPlugin = { id: 'plugin-1', name: 'Weather' } as Plugin

    slot.plugin = mockPlugin

    expect(slot.plugin).toBeDefined()
    expect(slot.plugin.id).toBe('plugin-1')
    expect(slot.plugin.name).toBe('Weather')
  })

  it('should have mashupConfiguration relationship', () => {
    const slot = new MashupSlot()
    const config = new MashupConfiguration()
    config.id = 'config-1'

    slot.mashupConfiguration = config

    expect(slot.mashupConfiguration).toBeDefined()
    expect(slot.mashupConfiguration.id).toBe('config-1')
  })

  it('should maintain order for slot positioning', () => {
    const slot1 = new MashupSlot()
    slot1.order = 0
    const slot2 = new MashupSlot()
    slot2.order = 1
    const slot3 = new MashupSlot()
    slot3.order = 2

    const slots = [slot1, slot2, slot3].sort((a, b) => a.order - b.order)

    expect(slots[0].order).toBe(0)
    expect(slots[1].order).toBe(1)
    expect(slots[2].order).toBe(2)
  })
})
