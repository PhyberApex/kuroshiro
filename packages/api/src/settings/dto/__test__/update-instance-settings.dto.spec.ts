import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'
import { UpdateInstanceSettingsDto } from '../update-instance-settings.dto.js'

async function rejectedFields(dto: object): Promise<string[]> {
  const errors = await validate(dto)
  return errors.map(error => error.property)
}

describe('updateInstanceSettingsDto', () => {
  it('accepts an empty body, leaving every Setting untouched', async () => {
    await expect(rejectedFields(plainToInstance(UpdateInstanceSettingsDto, {}))).resolves.toEqual([])
  })

  it('accepts null for every Setting, clearing its override', async () => {
    const dto = plainToInstance(UpdateInstanceSettingsDto, { lowBatteryPercent: null, offlineMultiplier: null, fetchFailureThreshold: null, alertRetentionDays: null, deviceLogRetentionDays: null, firmwareAutoUpdate: null })
    await expect(rejectedFields(dto)).resolves.toEqual([])
  })

  it('accepts an in-range integer for every Setting', async () => {
    const dto = plainToInstance(UpdateInstanceSettingsDto, { lowBatteryPercent: 50, offlineMultiplier: 4, fetchFailureThreshold: 5, alertRetentionDays: 120, deviceLogRetentionDays: 14 })
    await expect(rejectedFields(dto)).resolves.toEqual([])
  })

  it('accepts true or false for firmwareAutoUpdate', async () => {
    await expect(rejectedFields(plainToInstance(UpdateInstanceSettingsDto, { firmwareAutoUpdate: true }))).resolves.toEqual([])
    await expect(rejectedFields(plainToInstance(UpdateInstanceSettingsDto, { firmwareAutoUpdate: false }))).resolves.toEqual([])
  })

  it('rejects a non-boolean firmwareAutoUpdate', async () => {
    await expect(rejectedFields(plainToInstance(UpdateInstanceSettingsDto, { firmwareAutoUpdate: 'yes' }))).resolves.toEqual(['firmwareAutoUpdate'])
    await expect(rejectedFields(plainToInstance(UpdateInstanceSettingsDto, { firmwareAutoUpdate: 1 }))).resolves.toEqual(['firmwareAutoUpdate'])
  })

  it('rejects a non-integer value', async () => {
    await expect(rejectedFields(plainToInstance(UpdateInstanceSettingsDto, { lowBatteryPercent: 1.5 }))).resolves.toEqual(['lowBatteryPercent'])
    await expect(rejectedFields(plainToInstance(UpdateInstanceSettingsDto, { offlineMultiplier: 'three' }))).resolves.toEqual(['offlineMultiplier'])
  })

  it('rejects lowBatteryPercent outside 1-100', async () => {
    await expect(rejectedFields(plainToInstance(UpdateInstanceSettingsDto, { lowBatteryPercent: 0 }))).resolves.toEqual(['lowBatteryPercent'])
    await expect(rejectedFields(plainToInstance(UpdateInstanceSettingsDto, { lowBatteryPercent: 101 }))).resolves.toEqual(['lowBatteryPercent'])
  })

  it('rejects an offlineMultiplier below 2', async () => {
    await expect(rejectedFields(plainToInstance(UpdateInstanceSettingsDto, { offlineMultiplier: 1 }))).resolves.toEqual(['offlineMultiplier'])
  })

  it('rejects a fetchFailureThreshold below 1', async () => {
    await expect(rejectedFields(plainToInstance(UpdateInstanceSettingsDto, { fetchFailureThreshold: 0 }))).resolves.toEqual(['fetchFailureThreshold'])
  })

  it('accepts 0 for a Retention age, which disables pruning for it', async () => {
    await expect(rejectedFields(plainToInstance(UpdateInstanceSettingsDto, { alertRetentionDays: 0, deviceLogRetentionDays: 0 }))).resolves.toEqual([])
  })

  it('rejects a negative Retention age', async () => {
    await expect(rejectedFields(plainToInstance(UpdateInstanceSettingsDto, { alertRetentionDays: -1, deviceLogRetentionDays: -30 }))).resolves.toEqual(['alertRetentionDays', 'deviceLogRetentionDays'])
  })

  it('rejects a non-integer Retention age', async () => {
    await expect(rejectedFields(plainToInstance(UpdateInstanceSettingsDto, { alertRetentionDays: 1.5, deviceLogRetentionDays: 'thirty' }))).resolves.toEqual(['alertRetentionDays', 'deviceLogRetentionDays'])
  })
})
