import type { PluginDetail, UpdatePluginInput } from 'kuroshiro-shared'
import { http, HttpResponse } from 'msw'
import { expect, onTestFinished } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildPluginDetail } from '@/testing/fixtures/plugins'
import { freezeTime } from '@/testing/time'
import { holdTabVisible } from '@/testing/visibility'

/** What the specs of the Plugin page and of its sections share: the faked Plugin, the mounted page and the save bar. */

export const WEATHER = buildPluginDetail({ id: 'weather', name: 'Weather' })

export const NOW = '2026-10-03T07:35:00.000Z'

/** The `{hh:mm}` of a sentence, which is in the timezone of the browser the spec runs in. */
export const clock = (at: string) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(at))

export interface Faked {
  plugin: PluginDetail
  /** What the page asked the server to save, in order. */
  saves: UpdatePluginInput[]
}

/** The Plugin as a save answers it by default: the name, the description and the refresh interval that were sent, laid over what was there. */
function withScalarsSaved(plugin: PluginDetail, { name, description, refreshInterval }: UpdatePluginInput): PluginDetail {
  return {
    ...plugin,
    name: name ?? plugin.name,
    description: description === undefined ? plugin.description : description,
    refreshInterval: refreshInterval ?? plugin.refreshInterval,
  }
}

/**
 * Fakes the Plugin's read and its save. What it holds is read on every request, so a test
 * changes it and asks for a refresh. A section whose collection the answer must hold passes
 * its own `answer`, which maps what was sent to the read model.
 */
export function fakePlugin(plugin: PluginDetail = WEATHER, answer = withScalarsSaved): Faked {
  const faked: Faked = { plugin, saves: [] }
  fakeShellReads()
  api.use(
    http.get(apiUrl(`plugins/${plugin.id}`), () => HttpResponse.json(faked.plugin)),
    http.patch(apiUrl(`plugins/${plugin.id}`), async ({ request }) => {
      const input = await request.json() as UpdatePluginInput
      faked.saves.push(input)
      faked.plugin = answer(faked.plugin, input)
      return HttpResponse.json(faked.plugin)
    }),
  )
  return faked
}

export async function mountPlugin(name = 'Weather', at = '/plugins/weather') {
  freezeTime(NOW)
  holdTabVisible()
  const screen = await mountApp({ at })
  await expect.element(screen.getByRole('heading', { name, level: 1 })).toBeVisible()
  return screen
}

export type Mounted = Awaited<ReturnType<typeof mountPlugin>>

/** Has the page read the Plugin again, as it does every 30 seconds. A re-read is held back while a typed-in control has the focus. */
export const refresh = () => window.dispatchEvent(new Event('focus'))

export const saveBar = (screen: Mounted) => screen.getByRole('region', { name: 'Unsaved changes' })

/** Catches what the page has the browser download, in place of the download. */
export function catchDownloads() {
  const addresses: string[] = []
  const hold = (event: MouseEvent) => {
    if (event.target instanceof HTMLAnchorElement && event.target.hasAttribute('download')) {
      event.preventDefault()
      addresses.push(event.target.href)
    }
  }
  document.addEventListener('click', hold, true)
  onTestFinished(() => document.removeEventListener('click', hold, true))
  return addresses
}
