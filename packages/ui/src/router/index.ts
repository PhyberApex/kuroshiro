import { createRouter, createWebHistory } from 'vue-router'
import { useDeviceStore } from '../stores/device'
import { usePluginsStore } from '../stores/plugins'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'overview',
      component: () => import('../views/OverviewView.vue'),
      beforeEnter: async () => {
        const store = useDeviceStore()
        await store.fetchDevices()
      },
    },
    {
      path: '/devices/:id',
      name: 'device',
      component: () => import('../views/DeviceDetailsView.vue'),
      props: true,
      beforeEnter: async (to) => {
        const store = useDeviceStore()
        await store.fetchDevices()
        if (!store.getById(to.params.id as string))
          return { name: 'overview' }
      },
    },
    {
      path: '/maintenance',
      name: 'maintenance',
      component: () => import('../views/MaintenanceView.vue'),
    },
    {
      path: '/virtualDevice',
      name: 'virtualDevice',
      component: () => import('../views/VirtualDeviceView.vue'),
      beforeEnter: async () => {
        const store = useDeviceStore()
        await store.fetchDevices()
      },
    },
    {
      path: '/htmlPreview',
      name: 'htmlPreview',
      component: () => import('../views/HtmlPreviewView.vue'),
      beforeEnter: async () => {
        const store = useDeviceStore()
        await store.fetchDevices()
      },
    },
    {
      path: '/plugins',
      name: 'pluginsOverview',
      component: () => import('../views/PluginsOverviewView.vue'),
    },
    {
      path: '/devices/:deviceId/plugins',
      name: 'plugins',
      component: () => import('../views/PluginsView.vue'),
      props: true,
      beforeEnter: async (to) => {
        const deviceStore = useDeviceStore()
        const pluginsStore = usePluginsStore()
        await deviceStore.fetchDevices()
        if (!deviceStore.getById(to.params.deviceId as string))
          return { name: 'overview' }
        await pluginsStore.fetchPluginsForDevice(to.params.deviceId as string)
      },
    },
    {
      path: '/plugins/create',
      name: 'pluginCreate',
      component: () => import('../views/PluginCreateView.vue'),
      beforeEnter: async () => {
        const store = useDeviceStore()
        await store.fetchDevices()
      },
    },
    {
      path: '/plugins/:id/edit',
      name: 'pluginEdit',
      component: () => import('../views/PluginEditView.vue'),
      props: true,
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
