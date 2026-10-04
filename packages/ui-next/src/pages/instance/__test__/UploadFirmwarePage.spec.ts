import type { Screen } from '@/pages/devices/__test__/deviceSettingsHarness'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { words } from '@/pages/devices/__test__/deviceSettingsHarness'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { mountApp } from '@/testing/app'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { fakeFirmware, mountUpload, rowsOf } from './firmwareHarness'

const MEGABYTE = 1024 * 1024

const firmwareFile = (name = 'trmnl-x.bin', bytes = 2048) => new File([new Uint8Array(bytes)], name)

const fileInput = (screen: Screen) => screen.getByLabelText('Choose file')
const version = (screen: Screen) => screen.getByRole('textbox', { name: 'Version' })
const label = (screen: Screen) => screen.getByRole('textbox', { name: 'Label optional' })
const fits = (screen: Screen) => screen.getByRole('radiogroup', { name: 'Fits' })
const upload = (screen: Screen) => screen.getByRole('button', { name: 'Upload Firmware' })
const path = (screen: Screen) => screen.router.currentRoute.value.fullPath

async function fillIn(screen: Screen, { file = firmwareFile(), entered = '2.0.4', ticked = ['TRMNL X'] } = {}) {
  await userEvent.upload(fileInput(screen), file)
  await version(screen).fill(entered)
  for (const model of ticked)
    await screen.getByRole('checkbox', { name: model }).click()
}

describe('upload Firmware', () => {
  it('is a page of the Instance frame under "Firmware", with the link back to it', async () => {
    fakeFirmware()
    const screen = await mountUpload()

    await expect.element(screen.getByRole('main').getByRole('link', { name: 'Firmware', exact: true }).first()).toHaveAttribute('aria-current', 'page')
    const back = screen.getByRole('main').element().querySelector('.back-link')
    expect(words(back)).toBe('Firmware')
    expect(back?.getAttribute('href')).toBe('/instance/firmware')
  })

  it('asks for the file, the version, a label and what it fits, and warns before the buttons', async () => {
    fakeFirmware()
    const screen = await mountUpload()

    await expect.element(screen.getByText('Drop a .bin here, up to 8 MB.')).toBeVisible()
    await expect.element(version(screen)).toHaveAccessibleDescription('As the Firmware reports it. A Device shows this as its version once it runs it.')
    await expect.element(label(screen)).toHaveAccessibleDescription('Told apart by this in a Device\'s Settings. Without one the file\'s name is used.')
    await expect.element(fits(screen).getByRole('radio', { name: 'Only these Device Models' })).toBeChecked()
    await expect.element(fits(screen).getByRole('radio', { name: 'Only these Device Models' })).toHaveAccessibleDescription('It is offered to, and can be pushed to, Devices of these Device Models only.')
    await expect.element(fits(screen).getByRole('radio', { name: 'Every Device Model' })).toHaveAccessibleDescription('Nothing stops it from being pushed to a Device it was not built for.')
    await expect.element(screen.getByText('Kuroshiro cannot tell whether a file is working Firmware. A Device pushed a wrong one may not start again.')).toBeVisible()
    await expect.element(screen.getByText('Version, label and Device Models cannot be changed afterwards.')).toBeVisible()
  })

  it('offers the Device Models that are not deprecated, with none ticked', async () => {
    fakeFirmware()
    const screen = await mountUpload()

    const offered = screen.getByRole('checkbox').elements()
    expect(offered.map(box => words(box.closest('label')))).toEqual(['TRMNL OG (1-bit)', 'TRMNL OG', 'TRMNL X'])
    expect(offered.filter(box => (box as HTMLInputElement).checked)).toEqual([])
  })

  it('uploads the file with its version, label and Device Models, and opens the Firmware page with the new row first', async () => {
    const faked = fakeFirmware()
    const screen = await mountUpload()

    await fillIn(screen, { ticked: ['TRMNL X', 'TRMNL OG'] })
    await label(screen).fill('TRMNL X nightly')
    await upload(screen).click()

    await expect.poll(() => path(screen)).toBe('/instance/firmware')
    expect(faked.uploads).toEqual([{ file: 'trmnl-x.bin', version: '2.0.4', label: 'TRMNL X nightly', compatibleModels: ['og_plus', 'v2'] }])
    await expect.poll(() => rowsOf(screen.getByRole('main').element().querySelector('#available'))[0]).toEqual([
      '2.0.4',
      'Custom · TRMNL X nightly · Fits TRMNL OG and TRMNL X',
      'Uploaded just now Delete',
    ])
  })

  it('uploads one that fits every Device Model without naming any, and without a label', async () => {
    const faked = fakeFirmware()
    const screen = await mountUpload()

    await fillIn(screen)
    await fits(screen).getByRole('radio', { name: 'Every Device Model' }).click()
    expect(screen.getByRole('checkbox').elements()).toEqual([])
    await upload(screen).click()

    await expect.poll(() => faked.uploads).toEqual([{ file: 'trmnl-x.bin', version: '2.0.4', label: null, compatibleModels: [] }])
  })

  describe('what it does not send', () => {
    it('is a file of another type', async () => {
      const faked = fakeFirmware()
      const screen = await mountUpload()

      await fillIn(screen, { file: firmwareFile('trmnl-x.zip') })
      await expect.element(screen.getByText('A Firmware file ends in .bin.')).toBeVisible()
      await upload(screen).click()

      await expect.element(screen.getByText('Choose the Firmware file to upload.')).toBeVisible()
      expect(faked.uploads).toEqual([])
    })

    it('is a file over the limit of the Instance', async () => {
      const faked = fakeFirmware()
      const screen = await mountUpload()

      await fillIn(screen, { file: firmwareFile('trmnl-x.bin', 9 * MEGABYTE) })
      await expect.element(screen.getByText('This file is 9 MB. A Firmware can be up to 8 MB.')).toBeVisible()
      await upload(screen).click()

      await expect.element(screen.getByText('Choose the Firmware file to upload.')).toBeVisible()
      expect(faked.uploads).toEqual([])
    })

    it('is a Firmware without a version', async () => {
      const faked = fakeFirmware()
      const screen = await mountUpload()

      await fillIn(screen, { entered: '  ' })
      await upload(screen).click()

      await expect.element(version(screen)).toHaveAccessibleDescription('A Firmware needs a version.')
      await expect.element(version(screen)).toHaveAttribute('aria-invalid', 'true')
      expect(faked.uploads).toEqual([])
    })

    it('is "Only these Device Models" with nothing ticked', async () => {
      const faked = fakeFirmware()
      const screen = await mountUpload()

      await fillIn(screen, { ticked: [] })
      await upload(screen).click()

      await expect.element(screen.getByText('Tick at least one Device Model, or choose “Every Device Model”.')).toBeVisible()
      expect(faked.uploads).toEqual([])
      expect(path(screen)).toBe('/instance/firmware/upload')

      await screen.getByRole('checkbox', { name: 'TRMNL X' }).click()
      await upload(screen).click()

      await expect.poll(() => faked.uploads).toHaveLength(1)
    })
  })

  describe('a refusal', () => {
    it('of a version that exists is worded on the Version field, and what was entered stays', async () => {
      fakeFirmware()
      api.use(http.post(apiUrl('firmware/upload'), () => apiErrorResponse({ statusCode: 409, code: 'firmware-version-taken' })))
      const screen = await mountUpload()

      await fillIn(screen, { entered: '1.7.9' })
      await upload(screen).click()

      await expect.element(version(screen)).toHaveAccessibleDescription('There is already a Firmware 1.7.9. Give this one a version that tells them apart.')
      await expect.element(version(screen)).toHaveValue('1.7.9')
      await expect.element(screen.getByText('trmnl-x.bin')).toBeVisible()
      expect(path(screen)).toBe('/instance/firmware/upload')
    })

    it('of a Device Model the Instance does not know is worded at "Fits"', async () => {
      fakeFirmware()
      api.use(http.post(apiUrl('firmware/upload'), () => apiErrorResponse({ statusCode: 422, code: 'device-model-unknown', details: { names: ['v2'] } })))
      const screen = await mountUpload()

      await fillIn(screen)
      await upload(screen).click()

      await expect.element(screen.getByText('This Instance does not know the Device Model v2. Untick it, or sync the Device Models from TRMNL.')).toBeVisible()
    })

    it('of a file the server finds too large is worded on the file', async () => {
      fakeFirmware()
      api.use(http.post(apiUrl('firmware/upload'), () => apiErrorResponse({ statusCode: 413, code: 'upload-too-large', details: { limitBytes: 8 * MEGABYTE } })))
      const screen = await mountUpload()

      await fillIn(screen)
      await upload(screen).click()

      await expect.element(screen.getByText('That file is larger than the 8 MB this Instance accepts.')).toBeVisible()
    })

    it('of any other kind is said beside the buttons', async () => {
      fakeFirmware()
      api.use(http.post(apiUrl('firmware/upload'), () => apiErrorResponse({ statusCode: 500, code: 'internal' })))
      const screen = await mountUpload()

      await fillIn(screen)
      await upload(screen).click()

      await expect.element(screen.getByText('Not uploaded. Something went wrong on the server.')).toBeVisible()
    })
  })

  it('asks before leaving with something entered, and leaves an empty form at once', async () => {
    fakeFirmware()
    const screen = await mountUpload()

    await version(screen).fill('2.0.4')
    await screen.getByRole('link', { name: 'Cancel' }).click()

    const question = screen.getByRole('alertdialog', { name: 'Leave without saving?' })
    await expect.element(question).toBeVisible()
    await expect.element(question.getByText('What you entered for the new Firmware.')).toBeVisible()
    await question.getByRole('button', { name: 'Keep editing' }).click()

    await version(screen).fill('')
    await screen.getByRole('link', { name: 'Cancel' }).click()
    await expect.poll(() => path(screen)).toBe('/instance/firmware')
  })

  it('says that the Device Models could not be loaded, in place of the form', async () => {
    fakeFirmware()
    api.use(http.get(apiUrl('device-models'), () => apiErrorResponse({ statusCode: 500, code: 'internal' })))
    const screen = await mountApp({ at: '/instance/firmware/upload' })

    await expect.element(screen.getByText('Could not load the Device Models.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Upload Firmware' }).elements()).toEqual([])
  })

  it('is accessible and does not overflow', async () => {
    fakeFirmware()
    const screen = await mountUpload()
    await fillIn(screen, { entered: '' })
    await upload(screen).click()
    await expect.element(version(screen)).toHaveAttribute('aria-invalid', 'true')

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
