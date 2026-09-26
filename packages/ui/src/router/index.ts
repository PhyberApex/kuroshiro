import { createRouter, createWebHistory } from 'vue-router'
import { useDeviceStore } from '../stores/device'
import { getBasePath } from '../utils/basePath'
import { routeParam } from '../utils/routeParam'

const router = createRouter({
  history: createWebHistory(getBasePath() || '/'),
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
        if (!store.getById(routeParam(to.params.id)))
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
