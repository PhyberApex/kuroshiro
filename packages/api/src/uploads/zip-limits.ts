import type AdmZip from 'adm-zip'
import { ApiException } from '../errors/api.exception.js'

function zipUnpacksTooLarge(limitBytes: number): ApiException {
  return new ApiException(413, 'zip-unpacks-too-large', `The .zip unpacks to more than ${limitBytes} bytes.`, { limitBytes })
}

/**
 * Refuses a zip whose entries together would take more than `limitBytes` once read, before any of them is.
 * adm-zip inflates a deflated entry up to the size it declares and stops there, and copies a stored one at its
 * packed length whatever it declares, so the larger of the two bounds what reading an entry holds in memory: a
 * small upload of zeros that truthfully declares gigabytes would otherwise be inflated in full, and many entries
 * pointing at the same stored bytes copied once each.
 */
export function assertUnpacksWithin(zip: AdmZip, limitBytes: number): void {
  const readBytes = zip.getEntries().reduce((sum, { header }) => sum + Math.max(header.size, header.compressedSize), 0)
  if (readBytes > limitBytes)
    throw zipUnpacksTooLarge(limitBytes)
}
