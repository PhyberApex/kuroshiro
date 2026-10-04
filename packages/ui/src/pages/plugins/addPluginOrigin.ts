import type { RouteLocationNormalized } from 'vue-router'

let origin: string | undefined

/** The `beforeEnter` of Add a Plugin: keeps where the admin came from. Opened by its address, the page came from nowhere. */
export function keepAddPluginOrigin(_to: RouteLocationNormalized, from: RouteLocationNormalized) {
  origin = from.matched.length > 0 ? from.fullPath : undefined
}

/** Where "Cancel" on Add a Plugin leads back to, when the admin came from a page of the app. */
export const addPluginOrigin = () => origin
