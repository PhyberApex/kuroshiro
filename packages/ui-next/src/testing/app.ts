import type { AlertsList, DeviceSummary, InstanceFacts } from 'kuroshiro-shared'
import type { RouteRecordRaw } from 'vue-router'
import type { Theme } from './theme'
import { http, HttpResponse } from 'msw'
import { render } from 'vitest-browser-vue'
import { createMemoryHistory } from 'vue-router'
import App from '@/App.vue'
import { sharedReads } from '@/reads/sharedReads'
import { createAppRouter } from '@/router'
import { api, apiUrl } from './api/server'
import { buildAlertsList } from './fixtures/alerts'
import { buildDeviceSummary } from './fixtures/devices'
import { buildInstanceFacts } from './fixtures/instance'
import { forceTheme } from './theme'

interface ShellReads {
  instance?: InstanceFacts
  devices?: DeviceSummary[]
  alerts?: AlertsList
}

/**
 * Fakes the three reads the shell makes on every page. Left out, the Instance is an
 * ordinary one with one Device, Kitchen, and no Alert firing.
 */
export function fakeShellReads({
  instance = buildInstanceFacts(),
  devices = [buildDeviceSummary()],
  alerts = buildAlertsList(),
}: ShellReads = {}) {
  api.use(
    http.get(apiUrl('instance'), () => HttpResponse.json(instance)),
    http.get(apiUrl('devices'), () => HttpResponse.json(devices)),
    http.get(apiUrl('alerts'), () => HttpResponse.json(alerts)),
  )
}

interface MountAppOptions {
  /** The path the app opens at. */
  at: string
  theme?: Theme
  /** Stand-in routes, for a spec of the shell itself. Left out, the app's own. */
  routes?: RouteRecordRaw[]
}

/**
 * Mounts the whole app, shell and real routes, opened at `at`. Fake the shell's reads with
 * `fakeShellReads()` and what the page itself reads before mounting.
 */
export async function mountApp({ at, theme = 'light', routes }: MountAppOptions) {
  const router = createAppRouter(createMemoryHistory(), routes)
  await router.push(at)
  await router.isReady()
  const screen = await render(App, { global: { plugins: [router, sharedReads] } })
  await forceTheme(theme)
  return { ...screen, router }
}
