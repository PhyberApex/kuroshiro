import type { RouteLocationRaw } from 'vue-router'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/** One link of an in-page navigation. */
export interface NavItem {
  label: string
  to: RouteLocationRaw
}

function leadsTo(path: string, currentPath: string) {
  return currentPath === path || currentPath.startsWith(path.endsWith('/') ? path : `${path}/`)
}

/**
 * Which of `paths` is the current page: the one the current path is at, or the nearest one
 * above it. So `/instance/firmware/upload` is still under "Firmware", and `/devices/7/settings`
 * is "Settings" and not `/devices/7`, although both lead to it. -1 when none does.
 */
export function indexOfCurrentPath(paths: string[], currentPath: string) {
  return paths.reduce(
    (nearest, path, index) => leadsTo(path, currentPath) && path.length > (paths[nearest]?.length ?? -1) ? index : nearest,
    -1,
  )
}

/** The item of a navigation that is the current page, as a reactive index into `items`. */
export function useCurrentNavItem(items: () => NavItem[]) {
  const router = useRouter()
  const route = useRoute()
  return computed(() => indexOfCurrentPath(items().map(item => router.resolve(item.to).path), route.path))
}
