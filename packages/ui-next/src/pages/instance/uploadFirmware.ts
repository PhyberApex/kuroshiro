import type { UploadFirmwareInput } from 'kuroshiro-shared'
import { fieldErrorsOf, isRefusal } from '@/api/client'
import { listed } from '@/pages/plugins/pluginWording'

/** Whether a Firmware is offered to some Device Models or to every one. */
export type Fits = 'some' | 'all'

export interface FirmwareDraft {
  file: File | null
  version: string
  label: string
  fits: Fits
  /** The names of the Device Models that are ticked. They count only while it fits some. */
  models: string[]
}

/** The fields of the form a problem is shown at. */
export type UploadProblems = Partial<Record<'file' | 'version' | 'fits', string>>

/** What keeps the form from being sent. */
export function draftProblems({ file, version, fits, models }: FirmwareDraft): UploadProblems {
  return {
    ...(file ? {} : { file: 'Choose the Firmware file to upload.' }),
    ...(version.trim() ? {} : { version: 'A Firmware needs a version.' }),
    ...(fits === 'some' && models.length === 0 ? { fits: 'Tick at least one Device Model, or choose “Every Device Model”.' } : {}),
  }
}

export function uploadInput({ version, label, fits, models }: FirmwareDraft): UploadFirmwareInput {
  return {
    version: version.trim(),
    ...(label.trim() ? { label: label.trim() } : {}),
    compatibleModels: fits === 'some' ? models : [],
  }
}

function unknownModels(names: unknown) {
  const unknown = Array.isArray(names) ? names.map(String) : []
  if (unknown.length === 0)
    return undefined
  return unknown.length === 1
    ? `This Instance does not know the Device Model ${unknown[0]}. Untick it, or sync the Device Models from TRMNL.`
    : `This Instance does not know the Device Models ${listed(unknown)}. Untick them, or sync the Device Models from TRMNL.`
}

/** The field a refused upload is about, with the refusal worded for it. Empty for a refusal that is about no field. */
export function uploadRefusedAt(error: unknown, version: string): UploadProblems {
  if (isRefusal(error, 'firmware-version-taken'))
    return { version: `There is already a Firmware ${version}. Give this one a version that tells them apart.` }
  if (isRefusal(error, 'device-model-unknown'))
    return { fits: unknownModels(error.details.names) ?? error.message }
  if (isRefusal(error, 'upload-too-large'))
    return { file: error.message }
  const { version: versionRefused } = fieldErrorsOf(error)
  return versionRefused ? { version: versionRefused } : {}
}
