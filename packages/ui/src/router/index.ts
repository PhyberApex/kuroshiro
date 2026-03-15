import { createRouter, createWebHistory } from 'vue-router'
import { useDeviceStore } from '../stores/device'

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
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
