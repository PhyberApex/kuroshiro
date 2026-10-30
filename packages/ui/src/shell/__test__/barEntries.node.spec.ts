import { describe, expect, it } from 'vitest'
import { namedDeviceEntries } from '../barEntries'

const entryFor = (name: string) => namedDeviceEntries([{ id: 'd1', name }])[0]!

describe('a Device\'s bar entry', () => {
  it('cuts an emoji name by characters, never inside an emoji', () => {
    expect(entryFor('Kitchen display🍳 and grill')).toEqual({
      label: 'Kitchen display🍳…',
      fullName: 'Kitchen display🍳 and grill',
      to: '/devices/d1',
    })
  })

  it('leaves a name of 16 characters whole when an emoji makes it longer than 16 code units', () => {
    expect(entryFor('Kitchen display🍳')).toEqual({ label: 'Kitchen display🍳', to: '/devices/d1' })
  })
})
