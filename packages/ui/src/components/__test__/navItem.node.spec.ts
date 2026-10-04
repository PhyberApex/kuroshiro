import { describe, expect, it } from 'vitest'
import { indexOfCurrentPath } from '../navItem'

const DEVICE_VIEWS = ['/devices/7', '/devices/7/settings', '/devices/7/logs']

describe('indexOfCurrentPath', () => {
  it('is the path the current one is at', () => {
    expect(indexOfCurrentPath(DEVICE_VIEWS, '/devices/7/logs')).toBe(2)
    expect(indexOfCurrentPath(DEVICE_VIEWS, '/devices/7')).toBe(0)
  })

  it('is the nearest path above a route that is not in the list', () => {
    expect(indexOfCurrentPath(DEVICE_VIEWS, '/devices/7/screens/new')).toBe(0)
    expect(indexOfCurrentPath(['/instance/settings', '/instance/firmware'], '/instance/firmware/upload')).toBe(1)
  })

  it('prefers the path it is at over one that merely leads to it', () => {
    expect(indexOfCurrentPath(DEVICE_VIEWS, '/devices/7/settings')).toBe(1)
    expect(indexOfCurrentPath([...DEVICE_VIEWS].reverse(), '/devices/7/settings')).toBe(1)
  })

  it('does not take a path that only shares its first letters', () => {
    expect(indexOfCurrentPath(['/instance/firm'], '/instance/firmware')).toBe(-1)
    expect(indexOfCurrentPath(['/devices/7'], '/devices/70')).toBe(-1)
  })

  it('is -1 when no path leads to the current one', () => {
    expect(indexOfCurrentPath(DEVICE_VIEWS, '/plugins')).toBe(-1)
    expect(indexOfCurrentPath([], '/plugins')).toBe(-1)
  })
})
