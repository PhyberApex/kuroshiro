import { CONNECT_PATH, DEVICES_PATH } from '@/shell/barEntries'

/** Where `/` leads: Connect a Device with no Devices, the Device when there is one, the Devices list from two on. */
export function landingPathFor(devices: { id: string }[]) {
  if (devices.length === 0)
    return CONNECT_PATH
  return devices.length === 1 ? `${DEVICES_PATH}/${devices[0]!.id}` : DEVICES_PATH
}
