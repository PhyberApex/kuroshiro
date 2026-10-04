import type { DeviceLogEntry, DeviceLogLevelFilter, DeviceLogStatus } from 'kuroshiro-shared'
import type { Sentence } from './sentence'
import { RETENTION_PATH } from '@/pages/instance/instancePaths'
import { possessive } from './screenNaming'
import { linkTo, sentence } from './sentence'

const DAY_MS = 24 * 60 * 60 * 1000

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
const DAY_OF_ANOTHER_YEAR = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const TO_THE_SECOND = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

// en-GB puts a comma after the weekday ("Wednesday, 30 September"), which the headings do without.
const dayName = (format: Intl.DateTimeFormat, at: Date) => format.format(at).replace(',', '')

/** The heading of a day in the list, in the browser's timezone: "Today", "Yesterday, Wednesday 30 September", "Tuesday 29 September". */
export function dayHeading(at: Date, now: Date) {
  const daysAgo = Math.round((startOfDay(now).getTime() - startOfDay(at).getTime()) / DAY_MS)
  if (daysAgo <= 0)
    return 'Today'
  if (daysAgo === 1)
    return `Yesterday, ${dayName(DAY, at)}`
  return at.getFullYear() === now.getFullYear() ? dayName(DAY, at) : dayName(DAY_OF_ANOTHER_YEAR, at)
}

/** "07:42:10", in the browser's timezone. */
export function logTime(at: Date) {
  return TO_THE_SECOND.format(at)
}

interface Counted {
  shown: number
  total: number
  matching: number
  filtered: boolean
}

export function countLine({ shown, total, matching, filtered }: Counted) {
  if (shown === 0)
    return ''
  return filtered ? `Showing ${shown} of ${matching} that match, newest first` : `Showing ${shown} of ${total}, newest first`
}

export const newEntriesLabel = (count: number) => count === 1 ? '1 new entry' : `${count} new entries`

export interface LogFilter {
  level: DeviceLogLevelFilter
  /** What is searched for, or nothing. */
  q: string
}

export function noMatchSentence(deviceName: string, { level, q }: LogFilter) {
  const log = `${possessive(deviceName)} Device Log`
  if (!q)
    return `Nothing in ${log} is a warning or an error.`
  return `Nothing in ${log} matches “${q}”${level === 'problems' ? ' among warnings and errors' : ''}.`
}

export interface MarkedPart {
  text: string
  marked: boolean
}

const asText = (sought: string) => sought.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A message in runs, with every occurrence of what is searched for marked, whatever its case. */
export function markedParts(message: string, q: string): MarkedPart[] {
  if (!q)
    return [{ text: message, marked: false }]
  // Splitting on a captured group keeps the matches, at every odd place.
  return message
    .split(new RegExp(`(${asText(q)})`, 'gi'))
    .map((text, index) => ({ text, marked: index % 2 === 1 }))
    .filter(part => part.text !== '')
}

export interface EntryFact {
  label: string
  value: string
}

// A typographic minus, which lines up with the digits.
const signed = (value: number) => String(value).replace('-', '−')

function statusWords(status: DeviceLogStatus) {
  return [
    status.batteryVoltage !== null && `battery ${status.batteryVoltage} V`,
    status.wifiRssi !== null && `rssi ${signed(status.wifiRssi)} dBm`,
    status.wifiStatus !== null && `Wi-Fi ${status.wifiStatus}`,
    status.freeHeapSize !== null && `free heap ${Math.round(status.freeHeapSize / 1000)} kB`,
    status.wakeReason !== null && `wake reason ${status.wakeReason}`,
  ].filter(words => words !== false).join(' · ')
}

const asWritten = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value)

/** What an opened entry shows, as label and value: only what the entry carries, the firmware's further fields under their own names. */
export function entryFacts({ source, status, firmwareVersion, extras }: DeviceLogEntry): EntryFact[] {
  return [
    ...(source ? [{ label: 'Source', value: source.line === null ? source.file : `${source.file}:${source.line}` }] : []),
    ...(status ? [{ label: 'Device status', value: statusWords(status) }] : []),
    ...(firmwareVersion ? [{ label: 'Firmware', value: firmwareVersion }] : []),
    ...Object.entries(extras).map(([label, value]) => ({ label, value: asWritten(value) })),
  ]
}

/** How long entries are kept. `days` is the Device Log's Retention age; 0 is Retention not pruning it. */
export function retentionSentence(days: number): Sentence {
  const retention = linkTo('Retention', RETENTION_PATH)
  return days > 0
    ? sentence(`Entries older than ${days} ${days === 1 ? 'day' : 'days'} are removed by `, retention, '.')
    : sentence('Entries stay until the Device Log is cleared: ', retention, ' does not remove them.')
}
