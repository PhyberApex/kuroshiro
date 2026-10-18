import { describe, expect, it } from 'vitest'
import { buildInstanceSettings } from '@/testing/fixtures/instance'
import { mount } from '@/testing/mount'
import InstanceSettingRow from '../InstanceSettingRow.vue'

const row = { settingKey: 'lowBatteryPercent', label: 'Battery low', before: 'below', after: '%' } as const

describe('an Instance Setting row', () => {
  it('takes a new Setting in place of the value in force and the value entered', async () => {
    const settings = buildInstanceSettings()
    const screen = await mount(InstanceSettingRow, {
      props: { ...row, setting: settings.lowBatteryPercent },
      slots: { note: ({ value }: { value: number }) => `Below ${value} %.` },
    })
    const field = screen.getByRole('spinbutton', { name: 'Battery low' })
    await field.fill('15')

    await screen.rerender({ setting: { override: 30, value: 30, fallbackSource: 'default', fallbackValue: 20 } })

    await expect.element(field).toHaveValue(30)
    await expect.element(screen.getByText('Below 30 %.')).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Reset to 20' })).toBeVisible()
  })
})
