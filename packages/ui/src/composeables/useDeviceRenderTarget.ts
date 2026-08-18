import type { Ref } from 'vue'
import type { Device } from '@/types'
import type { RenderTarget } from '@/utils/screenShell'
import { computed, onMounted } from 'vue'
import { useDeviceModelsStore } from '@/stores/deviceModels'
import { renderTargetFor } from '@/utils/renderTarget'

/** The model and palette a device's previews should be rendered with. */
export function useDeviceRenderTarget(device: Ref<Device | null | undefined>) {
  const deviceModelsStore = useDeviceModelsStore()
  onMounted(() => deviceModelsStore.ensureLoaded())
  return computed<RenderTarget>(() => renderTargetFor(device.value, deviceModelsStore))
}
