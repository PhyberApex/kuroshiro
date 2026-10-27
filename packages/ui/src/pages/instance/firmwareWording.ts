import type { DeviceModelRead, DeviceReference, FirmwareCatchUp, FirmwareRead, FirmwareSyncResult, SyncRun } from 'kuroshiro-shared'
import { listed } from '@/patterns/listed'

type ModelLabelled = Pick<DeviceModelRead, 'name' | 'label'>

function labelsOf(names: string[], models: ModelLabelled[]) {
  return listed(names.map(name => models.find(model => model.name === name)?.label ?? name))
}

function fitsWhich(compatibleModels: string[], models: ModelLabelled[]) {
  return compatibleModels.length === 0 ? 'Fits every Device Model' : `Fits ${labelsOf(compatibleModels, models)}`
}

/** "Official · Fits TRMNL OG", "Custom · Release candidate · Fits every Device Model". */
export function whatItIs({ kind, label, compatibleModels }: FirmwareRead, models: ModelLabelled[]) {
  return [kind === 'custom' ? 'Custom' : 'Official', kind === 'custom' ? label : null, fitsWhich(compatibleModels, models)]
    .filter(Boolean)
    .join(' · ')
}

/** The Devices a Firmware is on its way to, and the ones that already run it. */
export function headedFor({ targetOf, runningOn }: FirmwareRead) {
  return {
    goesOutTo: targetOf.filter(target => target.pushPending).map(({ id, name }): DeviceReference => ({ id, name })),
    runningOn,
  }
}

/** The version Firmware Auto-Update would hand out today, had it not started with the next one. The library comes newest first. */
export function newestOfficialVersion(firmware: FirmwareRead[]) {
  return firmware.find(candidate => candidate.kind !== 'custom' && !candidate.deprecated)?.version
}

/** The library's last line: the Device Models TRMNL's feed carries, as the current official Firmware fits them (ADR-0071). */
export function feedNote(firmware: FirmwareRead[], models: ModelLabelled[]) {
  const asks = 'Kuroshiro asks TRMNL for the newest official Firmware when it starts and every day at 04:00, server time.'
  const carried = [...new Set(firmware.filter(candidate => candidate.kind !== 'custom' && !candidate.deprecated).flatMap(candidate => candidate.compatibleModels))]
  return carried.length === 0
    ? `${asks} Until TRMNL's update feed gives this Instance any, every Device Model needs an upload.`
    : `${asks} TRMNL's update feed gives this Instance Firmware for ${labelsOf(carried, models)}; any other Device Model, TRMNL OG (B/W/R/Y) included, needs an upload.`
}

export function autoUpdateNote(on: boolean, newestVersion: string | undefined) {
  if (!on)
    return 'A Device only updates when you press “Update now” in its Settings. While on, each new official Firmware is pushed to every Device it fits.'
  const startsWith = newestVersion
    ? `It starts with the next official Firmware. Devices already registered are caught up with “Catch up now”.`
    : 'It starts with the next official Firmware.'
  return `Each new official Firmware becomes the target of every Device it fits, except a mirrored Device and one with a push already pending. ${startsWith}`
}

/** What the Available Firmware aside says of the last sync, before the time it ran; nothing where TRMNL was never asked. */
export function checkedNote(lastSync: SyncRun | null) {
  if (!lastSync)
    return undefined
  return lastSync.ok ? 'Checked TRMNL' : 'Last check of TRMNL failed'
}

/** What a sync that worked came to, by whether Firmware Auto-Update was on when it ran. */
export function syncOutcome({ inserted, version, assigned }: FirmwareSyncResult, autoUpdateOn: boolean) {
  if (!inserted)
    return `Nothing new. ${version} is still TRMNL's newest official Firmware.`
  if (!autoUpdateOn)
    return `Synced ${version}. No Device is given it until you choose it as that Device's target.`
  return assigned.length === 0
    ? `Synced ${version}. No Device it fits is free to take it.`
    : `Synced ${version}. Firmware Auto-Update made it the target of ${listed(assigned.map(device => device.name))}; it goes out at ${assigned.length === 1 ? 'its' : 'their'} next poll.`
}

const areGiven = (devices: DeviceReference[]) => devices.length === 1 ? 'is' : 'are'

/** What the confirmation says before "Catch up now" gives the current official Firmware out. */
export function catchUpWording({ version, assigned }: FirmwareCatchUp) {
  const names = listed(assigned.map(device => device.name))
  return {
    title: version ? `Catch up to ${version}?` : 'Catch up now?',
    says: assigned.length > 0
      ? `${names} ${areGiven(assigned)} behind ${version}. Each becomes ${assigned.length === 1 ? 'its' : 'their'} target, with a push pending, as if ${version} had just been synced. A mirrored Device and one with a push already pending are left as they are.`
      : version
        ? `No Device is behind ${version}. A Device that already reports it, is mirrored, has a push pending or is not a Model it fits is left as it is.`
        : 'There is no official Firmware to catch up to yet.',
  }
}

/** What a catch-up that ran came to. */
export function catchUpOutcome({ version, assigned }: FirmwareCatchUp) {
  return assigned.length === 0
    ? `No Device was behind ${version ?? 'the official Firmware'}, so none was given it.`
    : `${listed(assigned.map(device => device.name))} ${areGiven(assigned)} given ${version} at ${assigned.length === 1 ? 'its' : 'their'} next poll.`
}

export function earlierNote(newestVersion: string | undefined) {
  const offered = newestVersion ? `Replaced by ${newestVersion} and no longer offered as a target.` : 'No longer offered as a target.'
  return `${offered} A Device that already targets one keeps it.`
}

/** The server clears the target of every Device that has the Firmware, and with it a pending push. */
export function deletionWording({ version, label, filePresent, targetOf }: FirmwareRead) {
  const named = `Firmware ${version}${label ? ` (${label})` : ''}`
  const pending = targetOf.filter(target => target.pushPending).map(target => target.name)
  const onePending = pending.length === 1
  const oneTarget = targetOf.length === 1
  const cancelled = pending.length === 0
    ? undefined
    : `${listed(pending)} ${onePending ? 'has it as its' : 'have it as their'} target Firmware, with a push pending. Deleting cancels ${onePending ? 'that push' : 'those pushes'}.`
  return {
    title: `Delete Firmware ${version}?`,
    happens: cancelled,
    lost: [
      filePresent ? `${named} and its file.` : `${named}.`,
      cancelled && `The pending ${onePending ? 'push' : 'pushes'} to ${listed(pending)}.`,
    ].filter(Boolean).join(' '),
    stays: targetOf.length === 0
      ? 'Every Device goes on running the Firmware it has. No Device has this one as its target.'
      : `${listed(targetOf.map(target => target.name))} ${oneTarget ? 'goes' : 'go'} on running the Firmware ${oneTarget ? 'it has' : 'they have'}, with no target.`,
  }
}
