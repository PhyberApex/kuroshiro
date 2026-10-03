import type { RouteLocationRaw } from 'vue-router'

/** One link of an in-page navigation. */
export interface NavItem {
  label: string
  to: RouteLocationRaw
}
