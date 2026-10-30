import type AdmZip from 'adm-zip'
import { ApiException } from '../errors/api.exception.js'

function zipUnpacksTooLarge(limitBytes: number): ApiException {
  return new ApiException(413, 'zip-unpacks-too-large', `The .zip unpacks to more than ${limitBytes} bytes.`, { limitBytes })
}

/**
 * Refuses a zip whose entries together declare more than `limitBytes` once inflated, before any of them is read.
 * adm-zip inflates an entry up to the size it declares and stops there, so the declared sizes bound what reading
 * it holds in memory; a small upload of zeros that declares gigabytes truthfully would otherwise be inflated in full.
 */
export function assertUnpacksWithin(zip: AdmZip, limitBytes: number): void {
  const declaredBytes = zip.getEntries().reduce((sum, entry) => sum + entry.header.size, 0)
  if (declaredBytes > limitBytes)
    throw zipUnpacksTooLarge(limitBytes)
}
