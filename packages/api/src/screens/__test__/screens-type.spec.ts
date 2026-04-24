import type { MashupConfiguration } from '../../mashup/entities/mashup-configuration.entity'
import { describe, expect, it } from 'vitest'
import { Screen } from '../screens.entity'

describe('screen entity with type field', () => {
  it('should have default type of file', () => {
    const screen = new Screen()
    screen.type = 'file'

    expect(screen.type).toBe('file')
  })

  it('should support all screen types', () => {
    const validTypes: Array<'file' | 'external' | 'html' | 'plugin' | 'mashup'> = [
      'file',
      'external',
      'html',
      'plugin',
      'mashup',
    ]

    validTypes.forEach((type) => {
      const screen = new Screen()
      screen.type = type
      expect(screen.type).toBe(type)
    })
  })

  it('should have mashupConfiguration relationship for mashup type', () => {
    const screen = new Screen()
    screen.type = 'mashup'
    const mockConfig = { id: 'config-1', layout: '2x2' } as MashupConfiguration

    screen.mashupConfiguration = mockConfig

    expect(screen.mashupConfiguration).toBeDefined()
    expect(screen.mashupConfiguration.id).toBe('config-1')
    expect(screen.mashupConfiguration.layout).toBe('2x2')
  })

  it('should allow nullable mashupConfiguration for non-mashup types', () => {
    const screen = new Screen()
    screen.type = 'plugin'
    screen.mashupConfiguration = undefined

    expect(screen.type).toBe('plugin')
    expect(screen.mashupConfiguration).toBeUndefined()
  })
})
