import type { RouteRecordRaw } from 'vue-router'
import { keepAddPluginOrigin } from '@/pages/plugins/addPluginOrigin'

declare module 'vue-router' {
  interface RouteMeta {
    /** The title of a page that is not built yet, shown by the page that stands in for it. */
    notBuiltYet?: string
    /** The name of a page of the Instance frame, as the frame's page list shows it. */
    instancePage?: string
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
 * `{ path, component: () => import('@/pages/…Page.vue') }`; a `notBuiltYetUnder…` line stands in for one that is not.
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
      { path: 'screens/new', component: () => import('@/pages/devices/AddScreenPage.vue') },
      notBuiltYetUnderDevice('screens/:screenId/html'),
      { path: 'settings', component: () => import('@/pages/devices/DeviceSettingsPage.vue') },
      { path: 'logs', component: () => import('@/pages/devices/DeviceLogsPage.vue') },
    ],
  },
  { path: '/connect', component: () => import('@/pages/devices/ConnectPage.vue') },

  { path: '/plugins', component: () => import('@/pages/plugins/PluginsListPage.vue') },
  { path: '/plugins/new', component: () => import('@/pages/plugins/AddPluginPage.vue'), beforeEnter: keepAddPluginOrigin },
  { path: '/plugins/:pluginId', component: () => import('@/pages/plugins/PluginPage.vue') },
  { path: '/plugins/:pluginId/update', component: () => import('@/pages/plugins/RecipeUpdatePage.vue') },

  {
    path: '/instance',
    component: () => import('@/pages/instance/InstanceFrame.vue'),
    redirect: '/instance/settings',
    children: [
      instancePage('settings', 'Instance Settings', () => import('@/pages/instance/InstanceSettingsPage.vue')),
      instancePage('firmware', 'Firmware', () => import('@/pages/instance/FirmwarePage.vue')),
      { path: 'firmware/upload', component: () => import('@/pages/instance/UploadFirmwarePage.vue') },
      instancePage('models', 'Device Models and Palettes', () => import('@/pages/instance/DeviceModelsPage.vue')),
      instancePage('archive', 'Configuration Archive', () => import('@/pages/instance/ConfigurationArchivePage.vue')),
      instancePage('housekeeping', 'Housekeeping', () => import('@/pages/instance/HousekeepingPage.vue')),
      notBuiltYetUnderInstance('simulator', 'Device Simulator'),
    ],
  },

  { path: '/alerts', component: () => import('@/pages/alerts/AlertsPage.vue') },

  { path: '/:unknown(.*)*', component: () => import('@/pages/NotFoundPage.vue') },
]
