import type { DeviceModelRead, DeviceReference, FirmwareRead, FirmwareSyncResult } from 'kuroshiro-shared'
import { listed } from '@/pages/plugins/pluginWording'

type ModelLabelled = Pick<DeviceModelRead, 'name' | 'label'>

function fitsWhich(compatibleModels: string[], models: ModelLabelled[]) {
  const labelOf = (name: string) => models.find(model => model.name === name)?.label ?? name
  return compatibleModels.length === 0 ? 'Fits every Device Model' : `Fits ${listed(compatibleModels.map(labelOf))}`
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

export function autoUpdateNote(on: boolean, newestVersion: string | undefined) {
  if (!on)
    return 'A Device only updates when you press “Update now” in its Settings. While on, each new official Firmware is pushed to every Device it fits.'
  const startsWith = newestVersion
    ? `It starts with the next official Firmware; Devices are not caught up to ${newestVersion} now.`
    : 'It starts with the next official Firmware.'
  return `Each new official Firmware becomes the target of every Device it fits, except a mirrored Device and one with a push already pending. ${startsWith}`
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
