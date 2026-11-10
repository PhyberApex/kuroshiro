import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { devicePath } from '@/pages/devices/devicePaths'
import { possessive } from '@/pages/devices/screenNaming'
import { useDevices } from '@/reads/sharedReads'
import { carriedDevice, carryingSettled } from './addPlugin'
import { PLUGINS_PATH } from './pluginPaths'

/**
 * The Device a page that adds a Plugin carries in its address (`?device=`), whether that is known yet, and the back
 * link it then has: to the Device's Screens, or to all Plugins.
 */
export function useCarriedDevice() {
  const route = useRoute()
  const devices = useDevices()
  const device = computed(() => carriedDevice(devices.data, route.query.device))
  return {
    device,
    settled: computed(() => carryingSettled(devices, route.query.device)),
    back: computed(() => device.value
      ? { label: `${possessive(device.value.name)} Screens`, to: devicePath(device.value.id) }
      : { label: 'All Plugins', to: PLUGINS_PATH }),
  }
}
