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

/** A page under the Device frame that is not built yet. The frame has the title line, so the stand-in has none. */
function notBuiltYetUnderDevice(path: string): RouteRecordRaw {
  return { path, component: () => import('@/pages/devices/DeviceNotBuiltYetPage.vue') }
}

/**
 * Every route of the four route tables of `docs/ui/`. A built page is
 * `{ path, component: () => import('@/pages/…Page.vue') }`; a `notBuiltYet` line stands in for one that is not.
 * The pages of one Device are the children of the Device frame, which loads the Device and has its title line and tabs.
 */
export const routes: RouteRecordRaw[] = [
  { path: '/', component: () => import('@/pages/LandingPage.vue') },

  { path: '/devices', component: () => import('@/pages/devices/DevicesListPage.vue') },
  {
    path: '/devices/:deviceId',
    component: () => import('@/pages/devices/DeviceFrame.vue'),
    children: [
      { path: '', component: () => import('@/pages/devices/DeviceScreensPage.vue') },
      notBuiltYetUnderDevice('screens/new'),
      notBuiltYetUnderDevice('screens/:screenId/html'),
      notBuiltYetUnderDevice('settings'),
      notBuiltYetUnderDevice('logs'),
    ],
  },
  { path: '/connect', component: () => import('@/pages/devices/ConnectPage.vue') },

  { path: '/plugins', component: () => import('@/pages/plugins/PluginsListPage.vue') },
  notBuiltYet('/plugins/new', 'Add a Plugin'),
  { path: '/plugins/:pluginId', component: () => import('@/pages/plugins/PluginPage.vue') },
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
