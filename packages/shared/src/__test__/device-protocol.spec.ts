import { describe, expect, it } from 'vitest'
import { isButtonWake } from '../device-protocol.ts'

describe('isButtonWake', () => {
  it.each(['button', 'EXT0', 'EXT1'])('says %s is a press', (source) => {
    expect(isButtonWake(source)).toBe(true)
  })

  it.each(['powercycle', 'timer', 'unknown', 'touchpad', 'ext0', '', null, undefined])('says %s is a timer wake', (source) => {
    expect(isButtonWake(source)).toBe(false)
  })
})
