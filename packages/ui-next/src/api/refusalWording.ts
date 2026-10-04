import type { ApiError, ApiErrorCode } from 'kuroshiro-shared'
import { formatBytes } from '@/components/fileRules'

type Wording = string | ((refusal: ApiError) => string)

function uploadTooLarge({ details }: ApiError) {
  const limitBytes = details?.limitBytes
  return typeof limitBytes === 'number'
    ? `That file is larger than the ${formatBytes(limitBytes)} this Instance accepts.`
    : 'That file is larger than this Instance accepts.'
}

export const IMAGE_NOT_FETCHED = 'Kuroshiro could not fetch an image from this address.'

/**
 * The one refusal whose reason only the server knows: what the address answered, or that it did not answer.
 * The server opens a download's failure with words that say what the sentence here already says.
 */
function imageFetchFailed({ message }: ApiError) {
  const reason = message.replace(/^The image could not be fetched:\s*/, '')
  return [IMAGE_NOT_FETCHED, reason].filter(Boolean).join(' ')
}

export const NOT_A_RECIPE = 'This is not a Recipe address or id. It looks like https://trmnl.com/recipes/41120, or 41120.'

export const NOT_A_REPOSITORY = 'Enter a repository address like https://github.com/owner/repository.'

function recipeNotFound({ details }: ApiError) {
  const id = details?.id
  return typeof id === 'string' ? `TRMNL has no Recipe ${id}.` : 'TRMNL has no such Recipe.'
}

export const NOT_IN_DEMO = 'Not available in the demo.'

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
  'device-mac-taken': 'A Device with this MAC address is already registered.',
  'screen-not-found': 'That Screen does not exist.',
  'screen-field-not-for-kind': 'A Screen of that kind has no such setting.',
  'schedule-not-found': 'That Screen has no Schedule. It may have been removed.',
  'schedule-exists': 'That Screen already has a Schedule.',
  'plugin-not-found': 'That Plugin does not exist.',
  'assignment-not-found': 'That Plugin is not on this Device.',
  'plugin-already-assigned': 'That Plugin is already on this Device.',
  'plugin-in-mashup': 'That Plugin fills a slot in a Mashup. Give the slot another Plugin, or delete the Mashup.',
  'image-fetch-failed': imageFetchFailed,
  'image-unreadable': 'This file is not an image Kuroshiro can read. Use PNG, JPEG, BMP, GIF, TIFF or WebP.',
  'order-not-a-permutation': 'The Order has to name every Screen once.',
  'demo-mode': NOT_IN_DEMO,
  'upload-too-large': uploadTooLarge,
  'firmware-version-taken': 'There is already a Firmware with that version.',
  'device-model-unknown': 'This Instance does not know that Device Model.',
  'firmware-not-custom': 'Only a custom Firmware can be deleted.',
  'firmware-push-without-target': 'Choose a target Firmware before updating.',
  'firmware-push-mirrored': 'A mirrored Device is not given Firmware.',
  'firmware-push-pending': 'A Firmware push is waiting for the Device.',
  'upstream-unreachable': 'TRMNL did not answer.',
  'template-full-missing': 'A Plugin needs its full Template.',
  'template-invalid': 'A template cannot be parsed.',
  'notifications-off': 'Notifications are off on this Instance.',
  'notification-failed': 'Apprise did not accept it. Check that the Apprise sidecar is running, and its logs.',
  'import-not-zip': 'This file is not a .zip. A Plugin is imported from a .zip as Kuroshiro or TRMNL exports it.',
  'import-no-plugin': 'This .zip holds no Plugin. It needs a .trmnlp.yml and at least one .liquid template.',
  'import-legacy-format': 'This Plugin was exported in a format Kuroshiro no longer reads. Export it again where it came from.',
  'github-url-invalid': NOT_A_REPOSITORY,
  'github-repo-not-found': 'GitHub has no public repository at this address.',
  'recipe-id-invalid': NOT_A_RECIPE,
  'recipe-not-found': recipeNotFound,
  'recipe-oauth': 'This Recipe signs in to another service with OAuth, which Kuroshiro cannot do.',
  'recipe-strategy-unsupported': 'This Recipe gets its data pushed by TRMNL. Kuroshiro can only import Recipes that poll or hold fixed data. Build a Webhook Plugin instead.',
  // docs/ui/ has no sentence for it, so the server's own stands.
  'recipe-static-transform': ({ message }) => message,
}

/** A code this build does not know, from a newer server, falls back on the server's own sentence. */
export function wordRefusal(refusal: ApiError): string {
  const wording: Wording | undefined = REFUSAL_WORDING[refusal.code]
  if (wording === undefined)
    return refusal.message
  return typeof wording === 'string' ? wording : wording(refusal)
}
