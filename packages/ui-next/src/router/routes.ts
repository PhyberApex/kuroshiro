import type { RouteRecordRaw } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** The title of a page that is not built yet, shown by the page that stands in for it. */
    notBuiltYet?: string
  }
}

function notBuiltYet(path: string, title: string): RouteRecordRaw {
  return {
    path,
    component: () => import('@/pages/NotBuiltYetPage.vue'),
    meta: { notBuiltYet: title },
  }
}

/**
 * Every route of the four route tables of `docs/ui/`. A built page is
 * `{ path, component: () => import('@/pages/…Page.vue') }`; a `notBuiltYet` line stands in for one that is not.
 */
export const routes: RouteRecordRaw[] = [
  { path: '/', component: () => import('@/pages/LandingPage.vue') },

  notBuiltYet('/devices', 'Devices'),
  notBuiltYet('/devices/:deviceId', 'Screens'),
  notBuiltYet('/devices/:deviceId/screens/new', 'Add Screen'),
  notBuiltYet('/devices/:deviceId/screens/:screenId/html', 'Edit HTML'),
  notBuiltYet('/devices/:deviceId/settings', 'Settings'),
  notBuiltYet('/devices/:deviceId/logs', 'Logs'),
  notBuiltYet('/connect', 'Connect a Device'),

  notBuiltYet('/plugins', 'Plugins'),
  notBuiltYet('/plugins/new', 'Add a Plugin'),
  notBuiltYet('/plugins/:pluginId', 'Plugin'),
  notBuiltYet('/plugins/:pluginId/update', 'Recipe Update Check'),

  { path: '/instance', redirect: '/instance/settings' },
  notBuiltYet('/instance/settings', 'Instance Settings'),
  notBuiltYet('/instance/firmware', 'Firmware'),
  notBuiltYet('/instance/firmware/upload', 'Upload Firmware'),
  notBuiltYet('/instance/models', 'Device Models and Palettes'),
  notBuiltYet('/instance/archive', 'Configuration Archive'),
  notBuiltYet('/instance/housekeeping', 'Housekeeping'),
  notBuiltYet('/instance/simulator', 'Device Simulator'),

  notBuiltYet('/alerts', 'Alerts'),

  { path: '/:unknown(.*)*', component: () => import('@/pages/NotFoundPage.vue') },
]
