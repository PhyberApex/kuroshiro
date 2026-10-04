import type { RouteRecordRaw, RouterHistory, RouterScrollBehavior } from 'vue-router'
import { createRouter } from 'vue-router'
import { routes as appRoutes } from './routes'

const WAIT_FOR_FRAGMENT_MS = 3000

/** The path the UI is served under, read off the `<base href>` the API writes into index.html. */
export function basePathOf(baseUri: string) {
  return new URL(baseUri).pathname
}

const barHeight = () => document.querySelector('[data-shell-bar]')?.getBoundingClientRect().height ?? 0

/** A section named by the fragment may belong to a body that is still loading, so its element is waited for. */
function elementNamed(hash: string) {
  const deadline = Date.now() + WAIT_FOR_FRAGMENT_MS
  return new Promise<Element | null>((resolve) => {
    const look = () => {
      const element = document.getElementById(decodeURIComponent(hash.slice(1)))
      if (element || Date.now() > deadline)
        resolve(element)
      else
        requestAnimationFrame(look)
    }
    look()
  })
}

const scrollBehavior: RouterScrollBehavior = async (to, from, savedPosition) => {
  if (savedPosition)
    return savedPosition
  if (to.hash)
    return await elementNamed(to.hash) ? { el: to.hash, top: barHeight() } : false
  // A change of the query alone (an opened row, a search) is the same page: it stays where it is.
  return to.path === from.path ? false : { top: 0 }
}

export function createAppRouter(history: RouterHistory, routes: RouteRecordRaw[] = appRoutes) {
  return createRouter({ history, routes, scrollBehavior })
}
