import type { RouteRecordRaw } from 'vue-router'
import { keepAddPluginOrigin } from '@/pages/plugins/addPluginOrigin'

declare module 'vue-router' {
  interface RouteMeta {
    /** The name of a page of the Instance frame, as the frame's page list shows it. */
    instancePage?: string
  }
}

type LazyPage = () => Promise<unknown>

/** A built page of the Instance frame. The frame lists it under `label`, in the order the pages stand here. */
function instancePage(path: string, label: string, component: LazyPage): RouteRecordRaw {
  return { path, component, meta: { instancePage: label } }
}

/**
 * Every route of the four route tables of `docs/ui/`, each page
 * `{ path, component: () => import('@/pages/…Page.vue') }`.
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
      { path: 'screens/:screenId/html', component: () => import('@/pages/devices/EditHtmlPage.vue') },
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
      instancePage('simulator', 'Device Simulator', () => import('@/pages/instance/DeviceSimulatorPage.vue')),
    ],
  },

  { path: '/alerts', component: () => import('@/pages/alerts/AlertsPage.vue') },

  { path: '/:unknown(.*)*', component: () => import('@/pages/NotFoundPage.vue') },
]
