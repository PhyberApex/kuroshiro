import { describe, expect, it } from 'vitest'
import { makePlugin, makeScreen } from '../../test/fixtures.js'
import { screenNameOf } from '../screen-name.js'

describe('screenNameOf', () => {
  it('takes a Plugin Screen\'s name from its Plugin, not its (absent) filename', () => {
    const screen = makeScreen({ type: 'plugin', filename: null, plugin: makePlugin({ name: 'Weather' }) })

    expect(screenNameOf(screen)).toBe('Weather')
  })

  it('takes a non-Plugin Screen\'s name from its filename', () => {
    const screen = makeScreen({ type: 'file', filename: 'Photo' })

    expect(screenNameOf(screen)).toBe('Photo')
  })

  it('answers an empty string when neither is set', () => {
    expect(screenNameOf(makeScreen({ type: 'plugin', filename: null, plugin: null }))).toBe('')
    expect(screenNameOf(makeScreen({ type: 'file', filename: null }))).toBe('')
  })
})
