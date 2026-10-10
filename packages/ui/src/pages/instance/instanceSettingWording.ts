import type { SettingKey } from 'kuroshiro-shared'

/** What a Setting's field accepts, said in the explanation's place when what was entered is outside it. */
export const SETTING_RANGE_MESSAGES: Record<SettingKey, string> = {
  lowBatteryPercent: 'Enter a whole number from 1 to 100.',
  offlineMultiplier: 'Enter a whole number, 2 or more.',
  fetchFailureThreshold: 'Enter a whole number, 1 or more.',
  alertRetentionDays: 'Enter a whole number of days, or 0 to keep them for good.',
  deviceLogRetentionDays: 'Enter a whole number of days, or 0 to keep them for good.',
}

const LOW_BATTERY_RESOLVES_ABOVE = 5
const MAX_BATTERY_PERCENT = 100
const EXAMPLE_INTERVAL_MINUTES = 15
const SECONDS_PER_MINUTE = 60

const toOneDecimal = (count: number) => Number(count.toFixed(1))
const minutes = (count: number) => `${toOneDecimal(count)} ${toOneDecimal(count) === 1 ? 'minute' : 'minutes'}`

/** Where a firing low-battery Alert resolves, as the server works it out: {@link LOW_BATTERY_RESOLVES_ABOVE} above the threshold, capped at 100. */
export const resolvesAbove = (percent: number) => Math.min(percent + LOW_BATTERY_RESOLVES_ABOVE, MAX_BATTERY_PERCENT)

export function batteryLowNote(percent: number) {
  return `Fires when a Device's battery is below ${percent} %, and resolves once it is back at ${resolvesAbove(percent)} %.`
}

/** The one Device of an Instance that has exactly one: the Offline row is worded with its refresh rate. */
export interface OnlyDevice {
  name: string
  /** In seconds, as the Device's read gives it. */
  refreshRate: number
}

export function offlineNote(missedPolls: number, onlyDevice?: OnlyDevice) {
  const pollEvery = onlyDevice ? onlyDevice.refreshRate / SECONDS_PER_MINUTE : EXAMPLE_INTERVAL_MINUTES
  const example = onlyDevice
    ? `${onlyDevice.name} polls every ${minutes(pollEvery)}, so that is ${minutes(missedPolls * pollEvery)} without a poll.`
    : `For a Device polling every ${minutes(pollEvery)} that is ${minutes(missedPolls * pollEvery)} without a poll.`
  return `Fires when a Device has not polled for ${missedPolls} times its refresh rate. ${example} Sleep Mode's window does not count.`
}

export function fetchFailureStreakNote(failedFetches: number) {
  return `An Alert fires when the streak reaches ${failedFetches}. A Plugin that fetches every ${minutes(EXAMPLE_INTERVAL_MINUTES)} gets there after ${minutes(failedFetches * EXAMPLE_INTERVAL_MINUTES)}.`
}

export function resolvedAlertsNote(days: number) {
  return days === 0 ? 'Resolved Alerts are kept for good.' : 'A firing Alert is never removed.'
}

export function deviceLogEntriesNote(days: number) {
  return days === 0 ? 'Device Log entries are kept until you clear a Device\'s Logs.' : '0 keeps them until you clear a Device\'s Logs.'
}
