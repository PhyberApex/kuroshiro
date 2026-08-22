import { describe, expect, it } from 'vitest'
import { routeParam } from '../routeParam'

describe('routeParam', () => {
  it('passes a single string param through', () => {
    expect(routeParam('device-1')).toBe('device-1')
  })

  it('takes the first value of a repeated param', () => {
    expect(routeParam(['device-1', 'device-2'])).toBe('device-1')
  })

  it('passes undefined through', () => {
    expect(routeParam(undefined)).toBeUndefined()
  })
})
