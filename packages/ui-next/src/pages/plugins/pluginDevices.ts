import type { DeviceSummary, PluginAssignmentRead, PluginDetail, ScreenState } from 'kuroshiro-shared'
import { SCREEN_STATE_LABELS } from '@/components/screenRows'

export interface DeviceStanding {
  device: Pick<DeviceSummary, 'id' | 'name'>
  /** Left out where the Plugin is not assigned. */
  assignment?: PluginAssignmentRead
}

export function standingsOf(devices: Array<Pick<DeviceSummary, 'id' | 'name'>>, assignments: PluginAssignmentRead[]): DeviceStanding[] {
  const byDevice = new Map(assignments.map(assignment => [assignment.deviceId, assignment]))
  return devices.map(device => ({ device, assignment: byDevice.get(device.id) }))
}

/** The only Screen States the spec has this section say; the others are told on the Device. */
const SAID_STATES: ReadonlySet<ScreenState> = new Set(['active', 'scheduleOff'])

export function assignedStanding({ order, screenCount, state }: PluginAssignmentRead) {
  const place = `Order ${order} of ${screenCount}`
  return state && SAID_STATES.has(state) ? `${place} · ${SCREEN_STATE_LABELS[state]}` : place
}

export const notAssignedSentence = (reason?: string) => reason ? `Not assigned. ${reason}` : 'Not assigned.'

export function unassignWording(plugin: Pick<PluginDetail, 'name' | 'kind'>, deviceName: string) {
  const fedBy = plugin.kind === 'Webhook' ? 'its Webhook URL' : 'its Data Sources'
  return {
    title: `Unassign ${plugin.name} from ${deviceName}?`,
    lost: `This Screen on ${deviceName} and its Schedule.`,
    stays: `The Plugin ${plugin.name}, with its template, ${fedBy} and its place in any Mashup.`,
  }
}
