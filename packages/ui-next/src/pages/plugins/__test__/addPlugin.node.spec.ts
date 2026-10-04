import type { BuildDraft } from '../addPlugin'
import { describe, expect, it } from 'vitest'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildDraftChanged, buildInput, buildProblems, carriedDevice, newBuildDraft } from '../addPlugin'

const draft = (overrides: Partial<BuildDraft> = {}): BuildDraft => ({ ...newBuildDraft(), name: 'Doorbell note', ...overrides })

describe('building a Plugin', () => {
  it('starts with Replace, a Stream Limit of 20 and nothing to lose', () => {
    expect(newBuildDraft()).toEqual({ name: '', mergeStrategy: 'standard', streamLimit: 20 })
    expect(buildDraftChanged(newBuildDraft())).toBe(false)
    expect(buildDraftChanged(draft({ name: '  ' }))).toBe(false)
    expect(buildDraftChanged(draft())).toBe(true)
    expect(buildDraftChanged(draft({ name: '', mergeStrategy: 'stream' }))).toBe(true)
  })

  it('needs a name, whatever the Plugin Kind', () => {
    expect(buildProblems('Poll', draft({ name: ' ' }))).toEqual({ name: 'A Plugin needs a name.' })
    expect(buildProblems('Webhook', draft({ name: '' }))).toEqual({ name: 'A Plugin needs a name.' })
    expect(buildProblems('Poll', draft())).toEqual({})
  })

  it.each([0, -3, 2.5, null])('needs a whole Stream Limit of 1 or more for a stream, not %s', (streamLimit) => {
    expect(buildProblems('Webhook', draft({ mergeStrategy: 'stream', streamLimit }))).toEqual({ streamLimit: 'Enter a whole number of 1 or more.' })
  })

  it('does not ask for a Stream Limit where there is no stream', () => {
    expect(buildProblems('Webhook', draft({ mergeStrategy: 'deep_merge', streamLimit: null }))).toEqual({})
    expect(buildProblems('Poll', draft({ mergeStrategy: 'stream', streamLimit: null }))).toEqual({})
    expect(buildProblems('Webhook', draft({ mergeStrategy: 'stream', streamLimit: 1 }))).toEqual({})
  })

  it('sends a Poll Plugin as its trimmed name alone, and the Device it carries', () => {
    expect(buildInput('Poll', draft({ name: ' Weather ', mergeStrategy: 'stream' }))).toEqual({ kind: 'Poll', name: 'Weather' })
    expect(buildInput('Poll', draft({ name: 'Weather' }), 'kitchen')).toEqual({ kind: 'Poll', name: 'Weather', deviceId: 'kitchen' })
  })

  it('sends a Webhook Plugin with its Merge Strategy, and the Stream Limit only for a stream', () => {
    expect(buildInput('Webhook', draft({ mergeStrategy: 'deep_merge', streamLimit: 50 }))).toEqual({ kind: 'Webhook', name: 'Doorbell note', mergeStrategy: 'deep_merge' })
    expect(buildInput('Webhook', draft({ mergeStrategy: 'stream', streamLimit: 50 }), 'kitchen')).toEqual({ kind: 'Webhook', name: 'Doorbell note', mergeStrategy: 'stream', streamLimit: 50, deviceId: 'kitchen' })
  })

  it('carries the Device the address names, and nothing for an id of no Device', () => {
    const devices = [buildDeviceSummary({ id: 'kitchen', name: 'Kitchen' })]

    expect(carriedDevice(devices, 'kitchen')).toEqual({ id: 'kitchen', name: 'Kitchen' })
    expect(carriedDevice(devices, 'attic')).toBeUndefined()
    expect(carriedDevice(devices, undefined)).toBeUndefined()
    expect(carriedDevice(undefined, 'kitchen')).toBeUndefined()
  })
})
