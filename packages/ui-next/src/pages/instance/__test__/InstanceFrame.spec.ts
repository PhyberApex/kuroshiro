import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { APPEARANCE_STORAGE_KEY, applyStoredAppearance } from '@/shell/appearance'
import { expectAccessible } from '@/testing/a11y'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildDeviceDetail } from '@/testing/fixtures/devices'
import { buildInstanceFacts, buildInstanceSettings } from '@/testing/fixtures/instance'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { resetViewport, resizeTo } from '@/testing/viewport'

function fakeInstancePage() {
  fakeShellReads({ instance: buildInstanceFacts({ version: '0.18.0' }) })
  api.use(
    http.get(apiUrl('settings'), () => HttpResponse.json(buildInstanceSettings())),
    http.get(apiUrl(`devices/${buildDeviceDetail().id}`), () => HttpResponse.json(buildDeviceDetail())),
  )
}

async function mountInstance(at = '/instance') {
  fakeInstancePage()
  const screen = await mountApp({ at })
  await expect.element(screen.getByRole('heading', { level: 1, name: 'Instance' })).toBeVisible()
  return screen
}

const top = (element: Element) => element.getBoundingClientRect().top

afterEach(() => {
  localStorage.removeItem(APPEARANCE_STORAGE_KEY)
})

describe('the Instance frame', () => {
  it('opens Instance Settings at /instance, with "Instance" current in the bar', async () => {
    const screen = await mountInstance('/instance')

    expect(screen.router.currentRoute.value.path).toBe('/instance/settings')
    await expect.element(screen.getByRole('heading', { level: 2, name: 'Instance Settings' })).toBeVisible()
    await expect.element(screen.getByRole('banner').getByRole('link', { name: 'Instance' })).toHaveAttribute('aria-current', 'page')
  })

  it('lists the Instance pages that are built, the open one current', async () => {
    const screen = await mountInstance()
    const pages = screen.getByRole('navigation', { name: 'Instance' })

    expect(pages.getByRole('link').elements().map(link => link.textContent?.trim())).toEqual(['Instance Settings', 'Firmware', 'Device Models and Palettes', 'Configuration Archive'])
    await expect.element(pages.getByRole('link', { name: 'Instance Settings' })).toHaveAttribute('aria-current', 'page')
  })

  it('keeps "Instance" current in the bar and the frame around a page that is not built yet', async () => {
    const screen = await mountInstance('/instance/housekeeping')

    await expect.element(screen.getByRole('heading', { level: 2, name: 'Housekeeping' })).toBeVisible()
    await expect.element(screen.getByText('Not built yet')).toBeVisible()
    await expect.element(screen.getByRole('banner').getByRole('link', { name: 'Instance' })).toHaveAttribute('aria-current', 'page')
    await expect.element(screen.getByRole('navigation', { name: 'Instance' })).toBeVisible()
  })

  it('shows the version the Instance facts carry under the list', async () => {
    const screen = await mountInstance()

    await expect.element(screen.getByText('Kuroshiro 0.18.0')).toBeVisible()
  })

  describe('appearance', () => {
    it('follows the system until a side is chosen, and keeps the choice in this browser', async () => {
      const screen = await mountInstance()
      const appearance = screen.getByRole('radiogroup', { name: 'Appearance' })

      await appearance.getByRole('radio', { name: 'Dark' }).click()
      await expect.element(appearance.getByRole('radio', { name: 'Dark' })).toBeChecked()
      expect(document.documentElement.dataset.theme).toBe('dark')
      expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('dark')

      await appearance.getByRole('radio', { name: 'System' }).click()
      await expect.element(appearance.getByRole('radio', { name: 'System' })).toBeChecked()
      expect(document.documentElement.dataset.theme).toBeUndefined()
      expect(getComputedStyle(document.documentElement).colorScheme).toBe('light dark')
      expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('system')
    })

    it('survives a reload', async () => {
      localStorage.setItem(APPEARANCE_STORAGE_KEY, 'dark')
      delete document.documentElement.dataset.theme

      applyStoredAppearance()

      expect(document.documentElement.dataset.theme).toBe('dark')
      fakeInstancePage()
      const screen = await mountApp({ at: '/instance', theme: 'dark' })
      await expect.element(screen.getByRole('radio', { name: 'Dark' })).toBeChecked()
    })

    it('is "System" in a browser that has chosen nothing', async () => {
      const screen = await mountInstance()

      await expect.element(screen.getByRole('radio', { name: 'System' })).toBeChecked()
    })
  })

  it('moves Appearance and the version to the foot of the page on a phone', async () => {
    const screen = await mountInstance()

    await resizeTo(375)
    try {
      const page = screen.getByRole('heading', { level: 2, name: 'Instance Settings' }).element()
      await expect.poll(() => top(screen.getByRole('radiogroup', { name: 'Appearance' }).element())).toBeGreaterThan(top(page))
      expect(top(screen.getByText('Kuroshiro 0.18.0').element())).toBeGreaterThan(top(page))
      expect(top(screen.getByRole('navigation', { name: 'Instance' }).element())).toBeLessThan(top(page))
    }
    finally {
      await resetViewport()
    }
  })

  it('is accessible and does not overflow', async () => {
    await mountInstance('/instance/housekeeping')

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
