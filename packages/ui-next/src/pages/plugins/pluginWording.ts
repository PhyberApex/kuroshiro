import type { PluginKind, PluginPlace } from 'kuroshiro-shared'
import { screenName } from '@/pages/devices/screenNaming'

/** Names as a sentence lists them: "Kitchen", "Kitchen and Hallway", "Kitchen, Hallway and Study". */
export function listed(names: string[]) {
  return names.length < 2
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

/** What deleting a Plugin needs to know of it, from the list's row or from the Plugin's page. */
export interface DeletablePlugin {
  id: string
  name: string
  kind: PluginKind
  /** The names of the Devices it is assigned to. */
  deviceNames: string[]
  mashups: PluginPlace[]
}

export function lostWithPlugin({ kind, deviceNames }: DeletablePlugin) {
  const fedBy = kind === 'Webhook' ? 'Webhook URL and Webhook Payload' : 'Data Sources'
  const itself = `The Plugin: its template, its ${fedBy}, its Plugin Fields and Field Values.`
  return deviceNames.length === 0
    ? itself
    : `${itself} Its Screen on ${listed(deviceNames)}, with ${deviceNames.length === 1 ? 'its Schedule' : 'their Schedules'}.`
}

export function staysWithoutPlugin({ deviceNames }: DeletablePlugin) {
  return deviceNames.length === 0
    ? 'Everything else. It is on no Device.'
    : `The other Screens of ${listed(deviceNames)}, which move up in the Order.`
}

const mashupOnDevice = (mashup: PluginPlace) => `${screenName(mashup.name)} on ${mashup.deviceName}`

/** Why a Plugin that fills a Mashup slot cannot be deleted, and what makes it deletable. */
export function whyNotDeletable(pluginName: string, mashups: PluginPlace[]) {
  return mashups.length === 1
    ? `It fills a slot in the Mashup ${mashupOnDevice(mashups[0]!)}. Give that slot another Plugin, or delete the Mashup. Then ${pluginName} can be deleted.`
    : `It fills a slot in ${mashups.length} Mashups: ${mashups.map(mashupOnDevice).join(', ')}. Give those slots another Plugin, or delete the Mashups. Then ${pluginName} can be deleted.`
}
