import { createRouter, createWebHistory } from 'vue-router'
import { useDeviceStore } from '../stores/device'
import DeviceDetailsView from '../views/DeviceDetailsView.vue'
import MaintenanceView from '../views/MaintenanceView.vue'
import OverviewView from '../views/OverviewView.vue'
import VirtualDeviceView from '../views/VirtualDeviceView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'overview',
      component: OverviewView,
      beforeEnter: async () => {
        const store = useDeviceStore()
        await store.fetchDevices()
      },
    },
    {
      path: '/devices/:id',
      name: 'device',
      component: DeviceDetailsView,
      props: true,
      beforeEnter: async (to) => {
        const store = useDeviceStore()
        await store.fetchDevices()
        if (!store.getById(to.params.id as string))
          return 'devices'
      },
    },
    {
      path: '/maintenance',
      name: 'maintenance',
      component: MaintenanceView,
    },
    {
      path: '/virtualDevice',
      name: 'virtualDevice',
      component: VirtualDeviceView,
      beforeEnter: async () => {
        const store = useDeviceStore()
        await store.fetchDevices()
      },
    },
    // { path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
