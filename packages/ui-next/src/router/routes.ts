import type { RouteRecordRaw } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** The title of a page that is not built yet, shown by the page that stands in for it. */
    notBuiltYet?: string
    /** The name of a page of the Instance frame, as the frame's page list shows it. */
    instancePage?: string
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

type LazyPage = () => Promise<unknown>

/** A built page of the Instance frame. The frame lists it under `label`, in the order the pages stand here. */
function instancePage(path: string, label: string, component: LazyPage): RouteRecordRaw {
  return { path, component, meta: { instancePage: label } }
}

/** A page under the Instance frame that is not built yet. The frame leaves it out of its page list until it is an `instancePage`. */
function notBuiltYetUnderInstance(path: string, title: string): RouteRecordRaw {
  return { path, component: () => import('@/pages/instance/InstanceNotBuiltYetPage.vue'), meta: { notBuiltYet: title } }
}

/**
 * Every route of the four route tables of `docs/ui/`. A built page is
 * `{ path, component: () => import('@/pages/…Page.vue') }`; a `notBuiltYet` line stands in for one that is not.
 * The pages of one Device are the children of the Device frame, which loads the Device and has its title line and tabs.
 * The Instance pages are the children of the Instance frame, which has the title line, the page list, Appearance and the version.
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
      { path: 'logs', component: () => import('@/pages/devices/DeviceLogsPage.vue') },
    ],
  },
  { path: '/connect', component: () => import('@/pages/devices/ConnectPage.vue') },

  { path: '/plugins', component: () => import('@/pages/plugins/PluginsListPage.vue') },
  notBuiltYet('/plugins/new', 'Add a Plugin'),
  { path: '/plugins/:pluginId', component: () => import('@/pages/plugins/PluginPage.vue') },
  notBuiltYet('/plugins/:pluginId/update', 'Recipe Update Check'),

  {
    path: '/instance',
    component: () => import('@/pages/instance/InstanceFrame.vue'),
    redirect: '/instance/settings',
    children: [
      instancePage('settings', 'Instance Settings', () => import('@/pages/instance/InstanceSettingsPage.vue')),
      notBuiltYetUnderInstance('firmware', 'Firmware'),
      notBuiltYetUnderInstance('firmware/upload', 'Upload Firmware'),
      notBuiltYetUnderInstance('models', 'Device Models and Palettes'),
      notBuiltYetUnderInstance('archive', 'Configuration Archive'),
      notBuiltYetUnderInstance('housekeeping', 'Housekeeping'),
      notBuiltYetUnderInstance('simulator', 'Device Simulator'),
    ],
  },

  { path: '/alerts', component: () => import('@/pages/alerts/AlertsPage.vue') },

  { path: '/:unknown(.*)*', component: () => import('@/pages/NotFoundPage.vue') },
]
