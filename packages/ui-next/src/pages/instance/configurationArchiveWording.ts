import type { ConfigurationImportSummary, ImportCheck, ImportCounts, ImportWarning, Ref } from 'kuroshiro-shared'
import { isRefusal } from '@/api/client'
import { failureReason } from '@/components/failureReason'
import { possessive } from '@/pages/devices/screenNaming'
import { listed } from '@/patterns/listed'
import { exactTime } from '@/patterns/time'

const counted = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

const READS_FIRST = 'Kuroshiro reads the archive first and changes nothing until you confirm.'

/** The sentence over the drop zone, by how many Devices the Instance has. */
export function madeFor(deviceCount: number) {
  return deviceCount === 0
    ? `Made for a fresh Instance, like this one. ${READS_FIRST}`
    : `Made for a fresh Instance. This one already has ${counted(deviceCount, 'Device')}, so read what an import would change before you confirm it. ${READS_FIRST}`
}

/** What the archive is, from its manifest: "A Redacted Archive from Kuroshiro 0.17.1, exported 28 Sept 2026, 21:14." */
export function archiveLine({ kuroshiroVersion, exportedAt, redacted }: ImportCheck['archive']) {
  const exported = exportedAt === null ? Number.NaN : Date.parse(exportedAt)
  return [
    redacted ? 'A Redacted Archive' : 'A Configuration Archive',
    kuroshiroVersion === null ? '' : ` from Kuroshiro ${kuroshiroVersion}`,
    Number.isNaN(exported) ? '' : `, exported ${exactTime(new Date(exported))}`,
    '.',
  ].join('')
}

function withNames(count: string, devices: Ref[]) {
  return devices.length > 0 ? `${count} (${listed(devices.map(device => device.name))})` : count
}

const screens = (counts: ImportCounts) => counted(counts.screens ?? 0, 'Screen')

function screensWithSchedules(counts: ImportCounts) {
  if (!counts.schedules)
    return screens(counts)
  return counts.screens === 1 ? `${screens(counts)} with its Schedule` : `${screens(counts)} with their Schedules`
}

type KindWording = (counts: ImportCounts, devices: Ref[]) => string

/** The kinds a summary counts, in its order, each with how it is worded. The rows under a Plugin and under a Screen are counted with the record they belong to. */
const SUMMARY_KINDS = {
  devices: (counts, devices) => withNames(counted(counts.devices ?? 0, 'Device'), devices),
  plugins: counts => counted(counts.plugins ?? 0, 'Plugin'),
  screens,
  mashupConfigurations: counts => counted(counts.mashupConfigurations ?? 0, 'Mashup'),
  palettes: counts => counted(counts.palettes ?? 0, 'custom Palette'),
  firmware: counts => counted(counts.firmware ?? 0, 'custom Firmware', 'custom Firmware'),
} satisfies Record<string, KindWording>

function kindsOf(kinds: Record<string, KindWording>, counts: ImportCounts, devices: Ref[]) {
  return Object.entries(kinds).filter(([key]) => (counts[key] ?? 0) > 0).map(([, word]) => word(counts, devices))
}

function recordsIn(counts: ImportCounts) {
  return Object.keys(SUMMARY_KINDS).reduce((sum, key) => sum + (counts[key] ?? 0), 0)
}

export function addsLine({ adds, devices }: Pick<ImportCheck, 'adds' | 'devices'>) {
  return kindsOf({ ...SUMMARY_KINDS, screens: screensWithSchedules }, adds, devices.added).join(', ') || 'Nothing'
}

/** Nothing when the archive overwrites nothing: the summary then has no "Overwrites". */
export function overwritesLine({ overwrites, devices }: Pick<ImportCheck, 'overwrites' | 'devices'>) {
  const kinds = kindsOf(SUMMARY_KINDS, overwrites, devices.overwritten)
  if (kinds.length === 0)
    return undefined
  return recordsIn(overwrites) === 1
    ? `${listed(kinds)} that is already here under the same id. What you changed on it since the export is lost.`
    : `${listed(kinds)} that are already here under the same id. What you changed on them since the export is lost.`
}

export function replacesLine(settingsHeld: number) {
  return settingsHeld === 0
    ? 'The Instance Settings. The archive holds none, so every one goes back to its fallback.'
    : `The Instance Settings, with the ${settingsHeld} the archive holds. The others go back to their fallback.`
}

export const LEAVES_LINE = 'Everything here that is not in the archive. An import deletes nothing.'

/** What follows "Imported.", counting the records the summary before it counted. */
export function importedSentence({ created, updated }: ConfigurationImportSummary) {
  return `Added ${counted(recordsIn(created), 'record')} and overwrote ${recordsIn(updated)}. The Instance Settings were replaced.`
}

export function wordWarning(warning: ImportWarning): string {
  switch (warning.kind) {
    case 'device-apikey-redacted':
      return `${possessive(warning.device.name)} API key was redacted. ${warning.device.name} gets a new one and has to be set up again.`
    case 'webhook-token-redacted':
      return `The Webhook Token of ${warning.plugin.name} was redacted. It gets a new Webhook URL; whatever posts to it needs the new one.`
    case 'header-redacted':
      return `A header of ${warning.plugin.name} · ${warning.dataSource} was redacted and is left out. Enter it on the Plugin's page.`
    case 'mirror-apikey-redacted':
      return `${possessive(warning.device.name)} mirror API key was redacted. Mirroring is off for ${warning.device.name} until you enter it.`
    case 'field-value-redacted':
      return `${possessive(warning.plugin.name)} Field Value “${warning.label}” was redacted and is empty.`
    case 'field-value-without-field':
      return `${warning.plugin.name} has no Plugin Field “${warning.keyname}”, so the Field Value the archive holds for it is left out.`
    case 'previous-version-values-dropped':
      return `${possessive(warning.plugin.name)} Plugin Variables and the Field Values of its Screens are left out: Field Values now belong to the Plugin. Enter them on the Plugin's page.`
    case 'firmware-file-missing':
      return `Firmware ${warning.firmware.version} comes without its file. Upload it again before pushing it.`
    case 'device-model-unknown':
      return `${warning.device.name} names a Device Model this Instance does not know. It is resolved again at its next poll.`
    case 'palette-unknown':
      return `${warning.device.name} names a Palette this Instance does not know and uses its Device Model's richest Palette.`
    case 'firmware-unknown':
      return `${warning.device.name} names a target Firmware this Instance does not know and has no target Firmware.`
  }
}

const withFullStop = (sentence: string) => /[.!?]$/.test(sentence) ? sentence : `${sentence}.`

function schemaVersionReason({ archive, expected }: Record<string, unknown>, version: string) {
  const made = typeof archive === 'number' ? `It was made with archive version ${archive}` : 'It does not say its archive version'
  return `${made}, and this Kuroshiro reads version ${expected}. Export it again from an Instance running Kuroshiro ${version}.`
}

function recordRefusedReason({ entity, id, reason }: Record<string, unknown>) {
  const record = [entity, id].filter(part => typeof part === 'string').join(' ')
  const said = typeof reason === 'string' ? withFullStop(reason) : 'The database refused it.'
  return `${record ? `${record}: ` : ''}${said} Nothing was changed.`
}

export interface ArchiveNotice {
  title: string
  reason: string
}

/**
 * The notice that takes the summary's place when an archive is refused. `version` is this Kuroshiro's.
 * A failure that is not about the archive (the server does not answer, the file is over the limit)
 * keeps its own sentence under what could not be done: the archive was not `read`, or not `imported`.
 */
export function refusalNotice(error: unknown, version: string, notDone: 'read' | 'imported' = 'read'): ArchiveNotice {
  if (isRefusal(error, 'archive-schema-version'))
    return { title: 'This archive cannot be imported.', reason: schemaVersionReason(error.details, version) }
  if (isRefusal(error, 'archive-not-zip') || isRefusal(error, 'archive-not-configuration'))
    return { title: 'This is not a Configuration Archive.', reason: 'It has to be the .zip a Configuration Export made.' }
  if (isRefusal(error, 'archive-record-refused'))
    return { title: 'This archive cannot be imported.', reason: recordRefusedReason(error.details) }
  return { title: `This archive could not be ${notDone}.`, reason: failureReason(error) ?? 'Something went wrong.' }
}
