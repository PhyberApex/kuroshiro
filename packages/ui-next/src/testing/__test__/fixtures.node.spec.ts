import type { InstanceSettingsResponse } from 'kuroshiro-shared'
import { describe, expect, it } from 'vitest'
import { defineBuilder } from '../fixtures/defineBuilder'
import { buildApiError } from '../fixtures/errors'
import { buildInstanceSettings } from '../fixtures/instance'

describe('fixture builders', () => {
  it('build a whole read model with no arguments', () => {
    expect(buildApiError()).toEqual({
      statusCode: 404,
      code: 'not-found',
      message: 'Device 3f6c1c1e-9d0a-4f39-8a53-0c2f0a1d7b11 was not found.',
    })
  })

  it('replace only the keys a test overrides', () => {
    const settings = buildInstanceSettings({
      firmwareAutoUpdate: { override: true, value: true, fallbackSource: 'default', fallbackValue: false },
    })

    expect(settings.firmwareAutoUpdate.value).toBe(true)
    expect(settings.offlineMultiplier.value).toBe(3)
  })

  it('hand out a fresh value each time, so one test cannot change another\'s fixture', () => {
    buildInstanceSettings().lowBatteryPercent.value = 99

    expect(buildInstanceSettings().lowBatteryPercent.value).toBe(20)
  })

  it('do not compile when a required key of the read model is left out', () => {
    const { firmwareAutoUpdate, ...incomplete } = buildInstanceSettings()

    // @ts-expect-error the defaults lack `firmwareAutoUpdate`, a required key of the read model
    const buildIncomplete = defineBuilder<InstanceSettingsResponse>(() => incomplete)

    expect(buildIncomplete()).not.toHaveProperty('firmwareAutoUpdate')
    expect(firmwareAutoUpdate.value).toBe(false)
  })
})
