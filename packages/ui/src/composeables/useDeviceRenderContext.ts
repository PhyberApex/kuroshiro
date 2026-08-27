import { computed } from 'vue'
import { useDeviceRenderTarget } from '@/composeables/useDeviceRenderTarget'
import { useDeviceStore } from '@/stores/device'
import { useScreensStore } from '@/stores/screens'

/** Shared device lookup, render target, and screens store used by the screen-editing cards. */
export function useDeviceRenderContext(deviceId: () => string) {
  const screensStore = useScreensStore()
  const deviceStore = useDeviceStore()

  const device = computed(() => deviceStore.getById(deviceId()))
  const renderTarget = useDeviceRenderTarget(device)

  return { device, renderTarget, screensStore }
}
