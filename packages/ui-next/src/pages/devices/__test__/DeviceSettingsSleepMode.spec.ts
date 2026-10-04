import type { SleepState } from 'kuroshiro-shared'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { buildInstanceFacts } from '@/testing/fixtures/instance'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { fakeKitchenSettings, KITCHEN, mountSettings, noteOf, rowOf, sideOf, stateOf, words } from './deviceSettingsHarness'

type Screen = Awaited<ReturnType<typeof mountSettings>>

const NIGHTS: SleepState = { enabled: true, start: '23:00', end: '06:00', whileAsleep: 'fallback', inWindow: false, endsAt: null }
const asleepAt = (sleep: Partial<SleepState>) => ({ ...KITCHEN, sleep: { ...NIGHTS, ...sleep } })

const sleepSwitch = (screen: Screen) => screen.getByRole('switch', { name: 'Sleep Mode' })
const from = (screen: Screen) => screen.getByLabelText('Sleep Mode from')
const to = (screen: Screen) => screen.getByLabelText('Sleep Mode to')
const switchSays = (screen: Screen) => words(rowOf(screen, 'Sleep Mode')?.querySelector('.control-cell'))

describe('sleep Mode', () => {
  it('is off without its window and "While asleep"', async () => {
    fakeKitchenSettings()
    const screen = await mountSettings()

    await expect.element(sleepSwitch(screen)).toHaveAttribute('aria-checked', 'false')
    expect(switchSays(screen)).toBe('Off')
    expect(rowOf(screen, 'Window')).toBeUndefined()
    expect(rowOf(screen, 'While asleep')).toBeUndefined()
  })

  it('switches on with the window 23:00 to 06:00 the first time', async () => {
    const faked = fakeKitchenSettings()
    const screen = await mountSettings()

    await sleepSwitch(screen).click()

    await expect.element(from(screen)).toHaveValue('23:00')
    await expect.element(to(screen)).toHaveValue('06:00')
    expect(faked.writes).toEqual([{ sleepModeEnabled: true, sleepStartTime: 82800, sleepEndTime: 21600 }])
    expect(switchSays(screen)).toBe('On')
    await expect.poll(() => stateOf(screen, 'Sleep Mode')).toBe('Saved')
  })

  it('switches on and off with its own field alone once it has a window', async () => {
    const faked = fakeKitchenSettings({ device: asleepAt({ enabled: false, start: '22:00', end: '07:30' }) })
    const screen = await mountSettings()

    await sleepSwitch(screen).click()
    await expect.element(from(screen)).toHaveValue('22:00')
    await expect.poll(() => stateOf(screen, 'Sleep Mode')).toBe('Saved')
    await sleepSwitch(screen).click()

    await expect.poll(() => faked.writes).toEqual([{ sleepModeEnabled: true }, { sleepModeEnabled: false }])
    await expect.poll(() => rowOf(screen, 'Window')).toBeUndefined()
  })

  it('shows the window in the server\'s timezone and says when it crosses midnight', async () => {
    fakeKitchenSettings({ device: asleepAt({}), instance: buildInstanceFacts({ timezone: 'Europe/Berlin' }) })
    const screen = await mountSettings()

    await expect.element(from(screen)).toHaveValue('23:00')
    await expect.poll(() => sideOf(screen, 'Window')).toBe('Server timezone, Europe/Berlin')
    expect(noteOf(screen, 'Window')).toBe('This window crosses midnight.')
    expect(words(rowOf(screen, 'Window')?.querySelector('.control-cell'))).toBe('to')
  })

  it('sends only the end of the window that changed, as seconds of day', async () => {
    const faked = fakeKitchenSettings({ device: asleepAt({}) })
    const screen = await mountSettings()

    await to(screen).fill('07:30')
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => faked.writes).toEqual([{ sleepEndTime: 27000 }])
    await expect.poll(() => stateOf(screen, 'Window')).toBe('Saved')

    await from(screen).fill('01:00')
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => faked.writes).toEqual([{ sleepEndTime: 27000 }, { sleepStartTime: 3600 }])
    await expect.poll(() => noteOf(screen, 'Window')).toBe('')
  })

  it('sends "While asleep" as its own field', async () => {
    const faked = fakeKitchenSettings({ device: asleepAt({}) })
    const screen = await mountSettings()
    const choices = screen.getByRole('radiogroup', { name: 'While asleep' })

    await expect.element(choices.getByRole('radio', { name: 'Show the sleep Fallback Screen' })).toHaveAttribute('aria-checked', 'true')
    await expect.element(choices.getByRole('radio', { name: 'Show the sleep Fallback Screen' })).toHaveAccessibleDescription('“Asleep until 06:00”.')
    await expect.element(choices.getByRole('radio', { name: 'Keep the Current Screen' })).toHaveAccessibleDescription('Whatever Kitchen showed last stays on.')

    await choices.getByRole('radio', { name: 'Keep the Current Screen' }).click()

    await expect.poll(() => stateOf(screen, 'While asleep')).toBe('Saved')
    expect(faked.writes).toEqual([{ sleepScreenEnabled: false }])
    await expect.element(choices.getByRole('radio', { name: 'Keep the Current Screen' })).toHaveAttribute('aria-checked', 'true')
  })

  it('says until when it is in its window', async () => {
    fakeKitchenSettings({ device: asleepAt({ inWindow: true, endsAt: '2026-10-04T04:00:00.000Z' }) })
    const screen = await mountSettings()

    expect(noteOf(screen, 'Sleep Mode')).toBe('In its window until 06:00')
    await expectAccessible()
    await expectNoHorizontalOverflow()
  })

  it('is off while Mirroring, with the switch disabled', async () => {
    const faked = fakeKitchenSettings({ device: { ...asleepAt({}), isMirrored: true, mirror: { enabled: true, mac: 'A4:CF:12:9B:01:7E', apikeySet: true } } })
    const screen = await mountSettings()

    await expect.element(sleepSwitch(screen)).toBeDisabled()
    await expect.element(sleepSwitch(screen)).toHaveAttribute('aria-checked', 'false')
    expect(switchSays(screen)).toBe('Off while Mirroring')
    expect(rowOf(screen, 'Window')).toBeUndefined()
    await sleepSwitch(screen).click({ force: true })
    expect(faked.writes).toEqual([])
  })
})
