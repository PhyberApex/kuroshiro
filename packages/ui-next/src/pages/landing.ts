/** Where `/` leads: Connect a Device with no Devices, the Device when there is one, the Devices list from two on. */
export function landingPathFor(devices: { id: string }[]) {
  if (devices.length === 0)
    return '/connect'
  return devices.length === 1 ? `/devices/${devices[0]!.id}` : '/devices'
}
