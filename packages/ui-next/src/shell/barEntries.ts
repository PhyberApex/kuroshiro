import { indexOfCurrentPath } from '@/components/navItem'

/** A Device as the shell needs it. */
export interface NamedDevice {
  id: string
  name: string
}

export interface BarEntry {
  label: string
  /** The whole name, when `label` is a cut one: the link's tooltip and accessible name. */
  fullName?: string
  to: string
  /** Other paths the entry is current on, beside `to` and what is under it. */
  alsoCurrentOn?: string[]
}

/** From five Devices on the bar no longer names them. */
export const MOST_DEVICES_NAMED = 4
const LONGEST_NAME = 16

export const CONNECT_PATH = '/connect'
export const DEVICES_PATH = '/devices'

const devicePath = (device: NamedDevice) => `${DEVICES_PATH}/${device.id}`

function deviceEntry(device: NamedDevice): BarEntry {
  return device.name.length > LONGEST_NAME
    ? { label: `${device.name.slice(0, LONGEST_NAME)}…`, fullName: device.name, to: devicePath(device) }
    : { label: device.name, to: devicePath(device) }
}

/** The Devices by name, then "Connect a Device". */
export function namedDeviceEntries(devices: NamedDevice[]): BarEntry[] {
  return [...devices.map(deviceEntry), { label: 'Connect a Device', to: CONNECT_PATH }]
}

/** What stands for the Devices when the bar does not name them. */
export const DEVICES_ENTRY: BarEntry = { label: 'Devices', to: DEVICES_PATH, alsoCurrentOn: [CONNECT_PATH] }

export const SECTION_ENTRIES: BarEntry[] = [
  { label: 'Plugins', to: '/plugins' },
  { label: 'Instance', to: '/instance' },
]

/** The entry that is current at `path`, as an index into `entries`: the one whose path is nearest above it. -1 when none is. */
export function indexOfCurrentEntry(entries: BarEntry[], path: string) {
  const places = entries.flatMap((entry, index) => [entry.to, ...entry.alsoCurrentOn ?? []].map(place => ({ place, index })))
  return places[indexOfCurrentPath(places.map(({ place }) => place), path)]?.index ?? -1
}

/** Where the phone's first tab leads and what it is called, by the number of Devices. */
export function firstTabLabel(devices: NamedDevice[]) {
  if (devices.length === 0)
    return 'Connect'
  return devices.length === 1 ? devices[0]!.name : 'Devices'
}
