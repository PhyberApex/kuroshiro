import type { OnlyDevice } from './instanceSettingWording'
import { ref, watch } from 'vue'
import { getDevice } from '@/api/devices'
import { useDevices } from '@/reads/sharedReads'

/**
 * The Device of an Instance that has exactly one, read for its refresh rate, which the Devices
 * list does not carry. `undefined` with no Device or several, until it is read, and when it
 * cannot be read: the sentence that uses it has a wording without it.
 */
export function useOnlyDevice() {
  const devices = useDevices()
  const onlyDevice = ref<OnlyDevice>()
  const onlyDeviceId = () => devices.data?.length === 1 ? devices.data[0]!.id : undefined

  watch(onlyDeviceId, async (deviceId) => {
    onlyDevice.value = undefined
    if (deviceId === undefined)
      return
    const device = await getDevice(deviceId).catch(() => undefined)
    if (device?.id === onlyDeviceId())
      onlyDevice.value = device
  }, { immediate: true })

  return onlyDevice
}
