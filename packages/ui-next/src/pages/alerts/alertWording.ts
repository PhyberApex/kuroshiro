import type { AlertDetails, AlertSummary } from 'kuroshiro-shared'
import type { Sentence } from '@/pages/devices/sentence'
import { devicePath } from '@/pages/devices/devicePaths'
import { mono, sentence } from '@/pages/devices/sentence'
import { pluginPath } from '@/pages/plugins/pluginPaths'
import { clockTime, exactTime } from '@/patterns/time'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const DAYS_NAMED_BY_WEEKDAY = 7

const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long' })

const counted = (count: number, unit: string) => count === 0 ? [] : [`${count} ${unit}`]

/** "1 h 5 min": a length of time in its two largest units, leaving out one that is zero. */
export function duration(ms: number) {
  if (ms < MINUTE_MS)
    return 'under a minute'
  const days = Math.floor(ms / DAY_MS)
  const hours = Math.floor(ms % DAY_MS / HOUR_MS)
  const minutes = Math.floor(ms % HOUR_MS / MINUTE_MS)
  const parts = days > 0
    ? [`${days} ${days === 1 ? 'day' : 'days'}`, ...counted(hours, 'h')]
    : [...counted(hours, 'h'), ...counted(minutes, 'min')]
  return parts.join(' ')
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

/** How many calendar days before `now`'s day `at`'s day is, in the browser's timezone. */
const daysBefore = (at: Date, now: Date) => Math.round((startOfDay(now).getTime() - startOfDay(at).getTime()) / DAY_MS)

interface Moment {
  /** The day, where it is not today: "yesterday", "Wednesday". Nothing for a moment more than a week ago, which is a date. */
  day: string
  /** "08:10", or the date and time of a moment more than a week ago. */
  time: string
}

function momentOf(at: Date, now: Date): Moment {
  const days = daysBefore(at, now)
  if (days <= 0)
    return { day: 'today', time: clockTime(at) }
  if (days === 1)
    return { day: 'yesterday', time: clockTime(at) }
  return days < DAYS_NAMED_BY_WEEKDAY ? { day: WEEKDAY.format(at), time: clockTime(at) } : { day: '', time: exactTime(at) }
}

/** A moment inside a sentence: "08:10", "yesterday, 21:35", "Wednesday 02:10", "20 Aug 2026, 07:31". */
function midSentence({ day, time }: Moment) {
  if (day === 'today' || day === '')
    return time
  return day === 'yesterday' ? `${day}, ${time}` : `${day} ${time}`
}

const capitalised = (word: string) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`

/** Since when a firing Alert fires: "since 08:10", "since yesterday, 21:35". */
export function sinceWhen(openedAt: string, now: Date) {
  return `since ${midSentence(momentOf(new Date(openedAt), now))}`
}

/** When a resolved Alert fired and for how long: "Wednesday 02:10, for 1 h 30 min". */
export function firedFor({ openedAt, resolvedAt }: AlertSummary, now: Date) {
  const opened = new Date(openedAt)
  const { day, time } = momentOf(opened, now)
  const lasted = duration(new Date(resolvedAt ?? now).getTime() - opened.getTime())
  return `${day === '' ? time : `${capitalised(day)} ${time}`}, for ${lasted}`
}

export interface AlertSubject {
  /** The Device's name, or the Plugin's. */
  name: string
  /** The Data Source of a fetch Alert, which is shown in mono after the Plugin's name. */
  dataSource: string | null
  to: string
}

/** What an Alert is about and where that is looked at: the Device's Screens view, or the Plugin page at the Data Source. */
export function alertSubject({ deviceId, deviceName, pluginId, pluginName, dataSourceName }: AlertSummary): AlertSubject {
  if (deviceId !== undefined)
    return { name: deviceName ?? '', dataSource: null, to: devicePath(deviceId) }
  return {
    name: pluginName ?? '',
    dataSource: dataSourceName ?? null,
    to: `${pluginPath(pluginId ?? '')}?source=${encodeURIComponent(dataSourceName ?? '')}`,
  }
}

export interface AlertTold {
  now: Date
  /** The battery threshold in force, which a firing battery Alert is below. */
  lowBatteryPercent: number
}

const NOTHING: Sentence = []

function batteryWhy(details: AlertDetails, firing: boolean, { lowBatteryPercent }: AlertTold) {
  if (!('percent' in details))
    return NOTHING
  return sentence(firing ? `Battery at ${details.percent} %, below ${lowBatteryPercent} %` : `Battery at ${details.percent} %`)
}

function offlineWhy(details: AlertDetails, firing: boolean, { now }: AlertTold, openedAt: string) {
  if (!('lastSeen' in details))
    return NOTHING
  const lastSeen = new Date(details.lastSeen)
  if (firing)
    return sentence(`Last seen ${midSentence(momentOf(lastSeen, now))}, ${duration(now.getTime() - lastSeen.getTime())} ago`)
  const withoutPoll = new Date(openedAt).getTime() - lastSeen.getTime()
  return withoutPoll > 0 ? sentence(`No poll for ${duration(withoutPoll)}`) : NOTHING
}

function fetchWhy(details: AlertDetails, firing: boolean) {
  if (!('streak' in details) || details.streak < 1)
    return NOTHING
  const failed = `${details.streak} ${details.streak === 1 ? 'fetch' : 'fetches'} failed in a row`
  if (details.lastError === null)
    return sentence(firing ? `${failed}.` : failed)
  return sentence(firing ? `${failed}. The last answer: ` : `${failed}: `, mono(details.lastError))
}

/**
 * Why an Alert fires, or why a resolved one fired, from its kind and the cause it keeps.
 * An Alert that holds no cause of its kind (one resolved before the cause was kept) says nothing.
 */
export function alertWhy({ kind, details, openedAt, resolvedAt }: AlertSummary, told: AlertTold): Sentence {
  if (details === null)
    return NOTHING
  const firing = resolvedAt === null
  if (kind === 'device-low-battery')
    return batteryWhy(details, firing, told)
  return kind === 'device-offline' ? offlineWhy(details, firing, told, openedAt) : fetchWhy(details, firing)
}
