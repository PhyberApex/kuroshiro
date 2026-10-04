import type { ApiError, ApiErrorCode } from 'kuroshiro-shared'
import { formatBytes } from '@/components/fileRules'

type Wording = string | ((refusal: ApiError) => string)

function uploadTooLarge({ details }: ApiError) {
  const limitBytes = details?.limitBytes
  return typeof limitBytes === 'number'
    ? `That file is larger than the ${formatBytes(limitBytes)} this Instance accepts.`
    : 'That file is larger than this Instance accepts.'
}

/**
 * The sentence the admin reads for each code the admin API refuses with. Typed by the
 * union, so a code added to `API_ERROR_CODES` fails type-check here until it is worded.
 * A page that words one refusal more exactly catches it with `isRefusal(error, code)`.
 */
const REFUSAL_WORDING: Record<ApiErrorCode, Wording> = {
  'validation': 'Some of what was sent is not valid.',
  'bad-request': 'The server did not understand the request.',
  'forbidden': 'Not allowed on this Instance.',
  'not-found': 'That does not exist. It may have been deleted.',
  'conflict': 'That conflicts with what is there now.',
  'payload-too-large': uploadTooLarge,
  'unprocessable': 'That cannot be used.',
  'bad-gateway': 'A service Kuroshiro depends on did not answer.',
  'service-unavailable': 'Not available right now.',
  'internal': 'Something went wrong on the server.',
  'device-not-found': 'That Device does not exist.',
  'screen-not-found': 'That Screen does not exist.',
  'screen-field-not-for-kind': 'A Screen of that kind has no such setting.',
  'plugin-not-found': 'That Plugin does not exist.',
  'assignment-not-found': 'That Plugin is not on this Device.',
  'plugin-already-assigned': 'That Plugin is already on this Device.',
  'plugin-in-mashup': 'That Plugin fills a slot in a Mashup. Give the slot another Plugin, or delete the Mashup.',
  'image-fetch-failed': 'The image could not be fetched.',
  'image-unreadable': 'That file is not an image Kuroshiro can read.',
  'order-not-a-permutation': 'The Order has to name every Screen once.',
  'demo-mode': 'Not available in demo mode.',
  'upload-too-large': uploadTooLarge,
  'firmware-version-taken': 'There is already a Firmware with that version.',
  'device-model-unknown': 'This Instance does not know that Device Model.',
  'firmware-not-custom': 'Only a custom Firmware can be deleted.',
  'firmware-push-without-target': 'Choose a target Firmware before updating.',
  'firmware-push-mirrored': 'A mirrored Device is not given Firmware.',
  'firmware-push-pending': 'A Firmware push is waiting for the Device.',
  'upstream-unreachable': 'TRMNL did not answer.',
  'template-full-missing': 'A Plugin needs its full Template.',
}

/** A code this build does not know, from a newer server, falls back on the server's own sentence. */
export function wordRefusal(refusal: ApiError): string {
  const wording: Wording | undefined = REFUSAL_WORDING[refusal.code]
  if (wording === undefined)
    return refusal.message
  return typeof wording === 'string' ? wording : wording(refusal)
}
