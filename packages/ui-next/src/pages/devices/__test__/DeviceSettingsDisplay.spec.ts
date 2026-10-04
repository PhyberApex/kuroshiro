import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { apiErrorResponse } from '@/testing/api/server'
import { buildDeviceModel } from '@/testing/fixtures/device-models'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { choose, errorOf, fakeKitchenSettings, held, KITCHEN, MODELS, mountSettings, noteOf, offeredBy, rowOf, shownOf, sideOf, stateOf, words } from './deviceSettingsHarness'

type Screen = Awaited<ReturnType<typeof mountSettings>>

const nameField = (screen: Screen) => screen.getByRole('textbox', { name: 'Name' })
const rate = (screen: Screen) => screen.getByRole('spinbutton', { name: 'Refresh rate' })

async function enter(field: ReturnType<typeof nameField>, value: string) {
  await field.fill(value)
  await userEvent.keyboard('{Enter}')
}

describe('renaming a Device', () => {
  it('sends the name alone, and the title and the bar follow', async () => {
    const faked = fakeKitchenSettings()
    const screen = await mountSettings()

    await enter(nameField(screen), '  Pantry ')

    await expect.element(screen.getByRole('heading', { level: 1, name: 'Pantry' })).toBeVisible()
    await expect.element(screen.getByRole('banner').getByRole('link', { name: 'Pantry' })).toBeVisible()
    expect(faked.writes).toEqual([{ name: 'Pantry' }])
    await expect.element(nameField(screen)).toHaveValue('Pantry')
    expect(stateOf(screen, 'Name')).toBe('Saved')
  })

  it('refuses an empty name on the field and sends nothing', async () => {
    const faked = fakeKitchenSettings()
    const screen = await mountSettings()

    await enter(nameField(screen), '   ')

    await expect.poll(() => errorOf(screen, 'Name')).toBe('A Device needs a name.')
    await expect.element(nameField(screen)).toHaveAttribute('aria-invalid', 'true')
    expect(faked.writes).toEqual([])
    await expectAccessible()
  })

  it('says "Saving", then "Saved"', async () => {
    const faked = fakeKitchenSettings()
    const answer = held()
    faked.holding = answer.promise
    const screen = await mountSettings()

    await enter(nameField(screen), 'Pantry')
    await expect.poll(() => stateOf(screen, 'Name')).toBe('Saving')

    answer.release()
    await expect.poll(() => stateOf(screen, 'Name')).toBe('Saved')
  })

  it('says "Not saved" with the reason, keeps what was entered, and saves it on "Try again"', async () => {
    const faked = fakeKitchenSettings()
    faked.refusing = apiErrorResponse({ statusCode: 403, code: 'demo-mode' })
    const screen = await mountSettings()

    await enter(nameField(screen), 'Pantry')

    await expect.poll(() => stateOf(screen, 'Name')).toBe('Not saved. Not available in the demo.')
    await expect.element(nameField(screen)).toHaveValue('Pantry')
    await expect.element(screen.getByRole('heading', { level: 1, name: 'Kitchen' })).toBeVisible()

    faked.refusing = undefined
    await screen.getByRole('button', { name: 'Try again' }).click()

    await expect.element(screen.getByRole('heading', { level: 1, name: 'Pantry' })).toBeVisible()
    expect(faked.writes).toEqual([{ name: 'Pantry' }, { name: 'Pantry' }])
  })
})

describe('the Device Model of a Device', () => {
  it('offers the Device Models with their size, leaves out a deprecated one, and says what the Device reports', async () => {
    fakeKitchenSettings()
    const screen = await mountSettings()

    await expect.element(screen.getByRole('combobox', { name: 'Device Model' })).toHaveTextContent('TRMNL OG (2-bit) · 800 × 480')
    expect(sideOf(screen, 'Device Model')).toBe('Kitchen reports TRMNL OG (2-bit)')
    expect(noteOf(screen, 'Device Model')).toBe('')
    expect(await offeredBy(screen, 'Device Model')).toEqual(['TRMNL OG (2-bit) · 800 × 480', 'TRMNL X · 1872 × 1404'])
  })

  it('keeps a deprecated Device Model while it is the assigned one, and says TRMNL no longer lists it', async () => {
    fakeKitchenSettings({
      device: { ...KITCHEN, deviceModel: { name: 'kindle_4', label: 'Kindle 4', width: 600, height: 800, deprecated: true }, reported: { ...KITCHEN.reported, model: 'kindle_4', width: 600, height: 800 } },
    })
    const screen = await mountSettings()

    expect(noteOf(screen, 'Device Model')).toBe('TRMNL no longer lists this Device Model.')
    expect(await offeredBy(screen, 'Device Model')).toEqual(['TRMNL OG (2-bit) · 800 × 480', 'TRMNL X · 1872 × 1404', 'Kindle 4 · 600 × 800'])
  })

  it('says when the Device reports another size than its Device Model\'s', async () => {
    fakeKitchenSettings({ device: { ...KITCHEN, reported: { ...KITCHEN.reported, model: 'v2', width: 1872, height: 1404 } } })
    const screen = await mountSettings()

    expect(sideOf(screen, 'Device Model')).toBe('Kitchen reports TRMNL X')
    expect(noteOf(screen, 'Device Model')).toBe('Kitchen reports 1872 × 1404, which is not this Device Model\'s size. Images are rendered for the Device Model chosen here.')
    expect(rowOf(screen, 'Device Model')?.querySelector('.note svg')).not.toBeNull()
    await expectAccessible()
  })

  it('says what images are rendered for until a Device Model is resolved', async () => {
    fakeKitchenSettings({ device: { ...KITCHEN, deviceModel: null, palette: null, reported: { ...KITCHEN.reported, model: null, width: null, height: null } } })
    const screen = await mountSettings()

    expect(noteOf(screen, 'Device Model')).toBe('Not resolved yet. Images are rendered for TRMNL OG.')
    expect(sideOf(screen, 'Device Model')).toBe('')
    await expect.element(screen.getByRole('combobox', { name: 'Palette' })).toBeDisabled()
  })

  it('sends the Device Model alone, and the Palette follows the server\'s reset', async () => {
    const faked = fakeKitchenSettings()
    const screen = await mountSettings()

    await choose(screen, 'Device Model', 'TRMNL X · 1872 × 1404')

    await expect.element(screen.getByRole('combobox', { name: 'Palette' })).toHaveTextContent('Greyscale, 16 levels')
    expect(faked.writes).toEqual([{ deviceModelName: 'v2' }])
    expect(await offeredBy(screen, 'Palette')).toEqual(['Greyscale, 16 levels', 'Greyscale, 4 levels', 'Black and white'])
  })
})

describe('the Palette of a Device', () => {
  it('offers what the Device Model supports, a custom Palette marked, and sends the chosen one alone', async () => {
    const faked = fakeKitchenSettings()
    const screen = await mountSettings()

    expect(await offeredBy(screen, 'Palette')).toEqual(['Greyscale, 4 levels', 'Black and white', 'Warm paper · custom'])
    expect(noteOf(screen, 'Palette')).toBe('Changing the Device Model or the Palette converts this Device\'s stored images again.')

    await choose(screen, 'Palette', 'Warm paper · custom')

    await expect.poll(() => stateOf(screen, 'Palette')).toBe('Saved')
    expect(faked.writes).toEqual([{ paletteId: 'warm' }])
    await expect.element(screen.getByRole('combobox', { name: 'Palette' })).toHaveTextContent('Warm paper · custom')
  })
})

describe('the refresh rate', () => {
  it('reads in minutes, or in hours where it is whole hours', async () => {
    fakeKitchenSettings()
    const screen = await mountSettings()

    await expect.element(rate(screen)).toHaveValue(15)
    await expect.element(screen.getByRole('combobox', { name: 'Refresh rate unit' })).toHaveTextContent('minutes')
    expect(words(rowOf(screen, 'Refresh rate')?.querySelector('.control-cell'))).toContain('every')
    expect(noteOf(screen, 'Refresh rate')).toBe('How often Kitchen polls, and so how often Rotation moves on. It also sets when Kitchen counts as offline.')
  })

  it('sends minutes as seconds', async () => {
    const faked = fakeKitchenSettings()
    const screen = await mountSettings()

    await enter(rate(screen), '30')

    await expect.poll(() => stateOf(screen, 'Refresh rate')).toBe('Saved')
    expect(faked.writes).toEqual([{ refreshRate: 1800 }])
  })

  it('sends hours as seconds when the unit changes', async () => {
    const faked = fakeKitchenSettings()
    const screen = await mountSettings()

    await enter(rate(screen), '2')
    await expect.poll(() => faked.writes).toEqual([{ refreshRate: 120 }])
    await choose(screen, 'Refresh rate unit', 'hours')

    await expect.poll(() => faked.writes).toEqual([{ refreshRate: 120 }, { refreshRate: 7200 }])
    await expect.element(rate(screen)).toHaveValue(2)
    await expect.element(screen.getByRole('combobox', { name: 'Refresh rate unit' })).toHaveTextContent('hours')
  })

  it.for(['0', '1441', ''])('says what is allowed for "%s" and sends nothing', async (entered) => {
    const faked = fakeKitchenSettings()
    const screen = await mountSettings()

    await enter(rate(screen), entered)

    await expect.poll(() => errorOf(screen, 'Refresh rate')).toBe('Enter between 1 minute and 24 hours.')
    await expect.element(rate(screen)).toHaveAttribute('aria-invalid', 'true')
    expect(faked.writes).toEqual([])
  })

  it('is set by TRMNL on a Proxied Device', async () => {
    fakeKitchenSettings({ device: { ...KITCHEN, isMirrored: true, isProxied: true, mirror: { enabled: true, mac: KITCHEN.mac, apikeySet: true } } })
    const screen = await mountSettings()

    expect(shownOf(screen, 'Refresh rate')).toBe('Set by TRMNL')
    expect(noteOf(screen, 'Refresh rate')).toBe('Kitchen is a Proxied Device, so TRMNL\'s answer decides how often it polls.')
    expect(screen.getByRole('spinbutton', { name: 'Refresh rate' }).elements()).toEqual([])
  })
})

describe('the Display section', () => {
  it('names a Device Model the Instance does not know by what the Device reports', async () => {
    fakeKitchenSettings({ models: MODELS.concat(buildDeviceModel({ name: 'm5', label: 'M5Paper S3', width: 960, height: 540 })), device: { ...KITCHEN, reported: { ...KITCHEN.reported, model: 'seeed_e1002' } } })
    const screen = await mountSettings()

    expect(sideOf(screen, 'Device Model')).toBe('Kitchen reports seeed_e1002')
    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
