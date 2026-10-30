import type { SleepState } from 'kuroshiro-shared'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
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
const dialog = () => document.querySelector('[role="alertdialog"]')
const outcome = () => [...dialog()!.querySelectorAll('.outcome > div')].map(part => `${words(part.querySelector('dt'))} ${words(part.querySelector('dd'))}`)
const alps = () => new File(['alps'], 'alps.jpg', { type: 'image/jpeg' })

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

  it('switches back on with the window it keeps, which the API asks for alongside, and off with its own field alone', async () => {
    const faked = fakeKitchenSettings({ device: asleepAt({ enabled: false, start: '22:00', end: '07:30' }) })
    const screen = await mountSettings()

    await sleepSwitch(screen).click()
    await expect.element(from(screen)).toHaveValue('22:00')
    await expect.poll(() => stateOf(screen, 'Sleep Mode')).toBe('Saved')
    await sleepSwitch(screen).click()

    await expect.poll(() => faked.writes).toEqual([{ sleepModeEnabled: true, sleepStartTime: 79200, sleepEndTime: 27000 }, { sleepModeEnabled: false }])
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
    await expect.element(choices.getByRole('radio', { name: 'Show the sleep Fallback Screen' })).toHaveAccessibleDescription('“Asleep until 06:00”, or your own image.')
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

describe('sleep image', () => {
  const sleepImageRow = (screen: Screen) => rowOf(screen, 'Sleep image')

  it('is shown only with "Show the sleep Fallback Screen" chosen', async () => {
    fakeKitchenSettings({ device: asleepAt({ whileAsleep: 'keep' }) })
    const screen = await mountSettings()

    expect(sleepImageRow(screen)).toBeUndefined()
  })

  it('is not shown with Sleep Mode off', async () => {
    fakeKitchenSettings()
    const screen = await mountSettings()

    expect(sleepImageRow(screen)).toBeUndefined()
  })

  it('offers "Upload an image" without one, and uploads it without a reload', async () => {
    const faked = fakeKitchenSettings({ device: asleepAt({}) })
    const screen = await mountSettings()

    expect(noteOf(screen, 'Sleep image')).toBe('Optional. Without one, Kitchen shows the sleep Fallback Screen.')
    await screen.getByRole('button', { name: 'Upload an image' }).click()
    const input = screen.getByLabelText('Choose file')

    await userEvent.upload(input, alps())

    await expect.poll(() => faked.sleepImageUploads).toEqual(['alps.jpg'])
    await expect.element(screen.getByRole('img', { name: 'Kitchen\'s sleep image' })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Replace' })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Remove' })).toBeVisible()
    expect(noteOf(screen, 'Sleep image')).toBe('Shown instead of the sleep Fallback Screen.')
    await expectAccessible()
    await expectNoHorizontalOverflow()
  })

  it('replaces the image that is there', async () => {
    const faked = fakeKitchenSettings({ device: { ...asleepAt({}), sleepImagePath: '/screens/devices/kitchen/sleep-image.png?v=1' } })
    const screen = await mountSettings()

    await screen.getByRole('button', { name: 'Replace' }).click()
    const input = screen.getByLabelText('Choose file')
    await userEvent.upload(input, alps())

    await expect.poll(() => faked.sleepImageUploads).toEqual(['alps.jpg'])
    await expect.element(screen.getByRole('button', { name: 'Replace' })).toBeVisible()
  })

  it('removes the image, with its own confirmation', async () => {
    const faked = fakeKitchenSettings({ device: { ...asleepAt({}), sleepImagePath: '/screens/devices/kitchen/sleep-image.png?v=1' } })
    const screen = await mountSettings()

    await screen.getByRole('button', { name: 'Remove' }).click()

    await expect.element(screen.getByRole('alertdialog', { name: 'Remove Kitchen\'s sleep image?' })).toBeVisible()
    expect(outcome()).toEqual(['Lost The uploaded sleep image.', 'Stays Sleep Mode, which shows the sleep Fallback Screen again.'])
    expect(faked.sleepImageRemoved).toBe(0)

    await screen.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click()

    await expect.poll(() => faked.sleepImageRemoved).toBe(1)
    await expect.element(screen.getByRole('button', { name: 'Upload an image' })).toBeVisible()
    expect(noteOf(screen, 'Sleep image')).toBe('Optional. Without one, Kitchen shows the sleep Fallback Screen.')
  })

  it('is disabled in demo mode, with the same wording as File Screen uploads', async () => {
    fakeKitchenSettings({ device: asleepAt({}), instance: buildInstanceFacts({ demoMode: true }) })
    const screen = await mountSettings()

    await expect.element(screen.getByRole('button', { name: 'Upload an image' })).toBeDisabled()
    await expect.element(screen.getByRole('button', { name: 'Upload an image' })).toHaveAccessibleDescription('Not available in the demo.')
    await expect.element(screen.getByText('Not available in the demo.')).toBeVisible()
  })

  it('shows the failure pattern and keeps the previous image when an upload is refused', async () => {
    fakeKitchenSettings({ device: asleepAt({}) })
    api.use(http.put(apiUrl('devices/kitchen/sleep-image'), () => apiErrorResponse({ statusCode: 400, code: 'image-unreadable' })))
    const screen = await mountSettings()

    await screen.getByRole('button', { name: 'Upload an image' }).click()
    const input = screen.getByLabelText('Choose file')
    await userEvent.upload(input, alps())

    await expect.poll(() => stateOf(screen, 'Sleep image')).toBe('Not saved. This file is not an image Kuroshiro can read. Use PNG, JPEG, BMP, GIF, TIFF or WebP.')
    expect(screen.getByRole('img', { name: 'Kitchen\'s sleep image' }).query()).toBeNull()
  })
})
