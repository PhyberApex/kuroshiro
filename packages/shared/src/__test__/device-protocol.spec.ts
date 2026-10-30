import { describe, expect, it } from 'vitest'
import { imagePathOf, isButtonWake } from '../device-protocol.ts'

describe('isButtonWake', () => {
  it.each(['button', 'EXT0', 'EXT1'])('says %s is a press', (source) => {
    expect(isButtonWake(source)).toBe(true)
  })

  it.each(['powercycle', 'timer', 'unknown', 'touchpad', 'ext0', '', null, undefined])('says %s is a timer wake', (source) => {
    expect(isButtonWake(source)).toBe(false)
  })
})

describe('imagePathOf', () => {
  it.each([
    'http://192.168.1.10:3000/screens/devices/42/7.png?v=1759476660000',
    'https://home.example/kuroshiro/screens/devices/42/7.png?v=1759476660000',
    '/screens/devices/42/7.png?v=1759476660000',
  ])('keeps the path from /screens/ on of %s', (imageUrl) => {
    expect(imagePathOf(imageUrl)).toBe('/screens/devices/42/7.png?v=1759476660000')
  })

  it('leaves an address without /screens/ as it is', () => {
    expect(imagePathOf('http://192.168.1.10:3000/other.png')).toBe('http://192.168.1.10:3000/other.png')
  })
})
