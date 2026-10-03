import type { RouteRecordRaw } from 'vue-router'
import type { Theme } from './theme'
import { render } from 'vitest-browser-vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { forceTheme } from './theme'

type Render = typeof render

interface ThemeOption {
  theme?: Theme
}

/** Mounts one component in the page, with the tokens loaded and the theme forced (light unless asked otherwise). */
export const mount = (async (component, { theme = 'light', ...options }: Parameters<Render>[1] & ThemeOption = {}) => {
  const screen = await render(component, options)
  await forceTheme(theme)
  return screen
}) as (...args: [Parameters<Render>[0], (Parameters<Render>[1] & ThemeOption)?]) => ReturnType<Render>

interface MountPageOptions extends ThemeOption {
  routes: RouteRecordRaw[]
  /** The path the page opens at. */
  at: string
}

/**
 * Mounts a routed page: a test router over `routes`, already navigated to `at`. The API is
 * the faked one of `./api/server`, so fake what the page reads before mounting it.
 */
export async function mountPage({ routes, at, theme = 'light' }: MountPageOptions) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(at)
  await router.isReady()
  const screen = await render(RouterView, { global: { plugins: [router] } })
  await forceTheme(theme)
  return { ...screen, router }
}
