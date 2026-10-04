import type { DeviceSummary } from 'kuroshiro-shared'
import { computed, ref, shallowRef, watch } from 'vue'
import { usePolling } from '@/patterns/usePolling'
import { useDevices } from '@/reads/sharedReads'

const CALL_IN_POLL_MS = 3000

/**
 * Listens for Devices that call in while Connect a Device is open: asks for the Devices every
 * 3 seconds and tells apart the ones that were not there when the page opened, in the order
 * they arrived.
 */
export function useDevicesCallingIn() {
  const devices = useDevices()
  const thereAtOpen = shallowRef<Set<string>>()
  const arrivedIds = ref<string[]>([])

  watch(() => devices.data, (list) => {
    if (!list)
      return
    if (!thereAtOpen.value) {
      thereAtOpen.value = new Set(list.map(device => device.id))
      return
    }
    const known = new Set([...thereAtOpen.value, ...arrivedIds.value])
    const arrived = list.filter(device => !known.has(device.id)).map(device => device.id)
    if (arrived.length > 0)
      arrivedIds.value = [...arrivedIds.value, ...arrived]
  }, { immediate: true })

  // An answer that takes longer than the interval must still land, so the next question waits for it.
  let asking = false
  usePolling(() => {
    if (asking)
      return
    asking = true
    void devices.reload().finally(() => {
      asking = false
    })
  }, CALL_IN_POLL_MS)

  return {
    /** The Devices that called in since the page opened, the first to arrive first. */
    calledIn: computed(() => arrivedIds.value.flatMap((id): DeviceSummary[] => devices.data?.filter(device => device.id === id) ?? [])),
    /** Whether the Instance had no Devices when the page opened. */
    openedWithNoDevices: computed(() => thereAtOpen.value?.size === 0),
    /** Why the Devices cannot be asked for right now, as a sentence. */
    notAnswering: computed(() => devices.failure?.reason),
  }
}
