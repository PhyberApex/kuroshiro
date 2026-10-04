import type { ApiErrorCode } from '../api/errors'
import { describe, expect, it } from 'vitest'
import { API_ERROR_CODES } from '../api/errors'

/**
 * Stands in for the UI's wording table. Typed by the union, so a code added to
 * `API_ERROR_CODES` without a wording here fails type-check.
 */
const wording: Record<ApiErrorCode, string> = {
  'validation': 'Some fields are not valid.',
  'bad-request': 'The request was not understood.',
  'forbidden': 'Not allowed on this Instance.',
  'not-found': 'Not found.',
  'conflict': 'Conflicts with what is there now.',
  'payload-too-large': 'The upload is too large.',
  'unprocessable': 'That cannot be used.',
  'bad-gateway': 'A service Kuroshiro depends on did not answer.',
  'service-unavailable': 'Not available right now.',
  'internal': 'Something went wrong on the server.',
  'device-not-found': 'That Device does not exist.',
  'device-mac-taken': 'A Device with this MAC address is already registered.',
  'screen-not-found': 'That Screen does not exist.',
  'screen-field-not-for-kind': 'That Screen has no such setting.',
  'schedule-not-found': 'That Screen has no Schedule.',
  'schedule-exists': 'That Screen already has a Schedule.',
  'plugin-not-found': 'That Plugin does not exist.',
  'assignment-not-found': 'That Plugin is not on this Device.',
  'plugin-already-assigned': 'That Plugin is already on this Device.',
  'plugin-in-mashup': 'That Plugin fills a slot in a Mashup.',
  'image-fetch-failed': 'The image could not be fetched.',
  'image-unreadable': 'That file is not an image Kuroshiro can read.',
  'order-not-a-permutation': 'The Order has to name every Screen once.',
  'demo-mode': 'Not available in demo mode.',
  'upload-too-large': 'That file is larger than this Instance accepts.',
  'firmware-version-taken': 'There is already a Firmware with that version.',
  'device-model-unknown': 'This Instance does not know that Device Model.',
  'firmware-not-custom': 'Only a custom Firmware can be deleted.',
  'firmware-push-without-target': 'Choose a target Firmware before updating.',
  'firmware-push-mirrored': 'A mirrored Device is not given Firmware.',
  'firmware-push-pending': 'A Firmware push is waiting for the Device.',
  'upstream-unreachable': 'TRMNL did not answer.',
  'template-full-missing': 'A Plugin needs its full Template.',
  'template-invalid': 'A Template cannot be parsed.',
  'notifications-off': 'Notifications are off on this Instance.',
  'notification-failed': 'Apprise did not accept it.',
  'import-not-zip': 'That file is not a .zip.',
  'import-no-plugin': 'That holds no Plugin.',
  'import-legacy-format': 'That Plugin was exported in a format no longer read.',
  'github-url-invalid': 'That is not the address of a GitHub repository.',
  'github-repo-not-found': 'GitHub has no public repository at that address.',
  'recipe-id-invalid': 'That is not a Recipe address or id.',
  'recipe-not-found': 'TRMNL has no such Recipe.',
  'recipe-oauth': 'That Recipe signs in with OAuth.',
  'recipe-strategy-unsupported': 'That Recipe does not poll or hold fixed data.',
  'recipe-static-transform': 'That Recipe holds fixed data and a transform.',
  'plugin-not-from-recipe': 'That Plugin was not imported from a Recipe.',
  'recipe-changed': 'The Recipe changed since it was compared.',
  'archive-not-zip': 'That file is not a .zip.',
  'archive-not-configuration': 'That is not a Configuration Archive.',
  'archive-schema-version': 'That archive was made with another archive version.',
  'archive-record-refused': 'The database refused a record of that archive.',
  'palette-name-taken': 'There is already a custom Palette with that name.',
  'palette-not-custom': 'Only a custom Palette can be changed.',
  'palette-in-use': 'A Device uses that Palette.',
}

function wordingBySwitch(code: ApiErrorCode): string {
  switch (code) {
    case 'validation':
    case 'bad-request':
      return 'Check what you sent.'
    case 'forbidden':
    case 'not-found':
    case 'device-not-found':
    case 'device-mac-taken':
    case 'screen-not-found':
    case 'screen-field-not-for-kind':
    case 'schedule-not-found':
    case 'schedule-exists':
    case 'plugin-not-found':
    case 'assignment-not-found':
    case 'plugin-already-assigned':
    case 'plugin-in-mashup':
    case 'image-fetch-failed':
    case 'image-unreadable':
    case 'order-not-a-permutation':
    case 'demo-mode':
    case 'upload-too-large':
    case 'firmware-version-taken':
    case 'device-model-unknown':
    case 'firmware-not-custom':
    case 'firmware-push-without-target':
    case 'firmware-push-mirrored':
    case 'firmware-push-pending':
    case 'template-full-missing':
    case 'template-invalid':
    case 'notifications-off':
    case 'import-not-zip':
    case 'import-no-plugin':
    case 'import-legacy-format':
    case 'github-url-invalid':
    case 'github-repo-not-found':
    case 'recipe-id-invalid':
    case 'recipe-not-found':
    case 'recipe-oauth':
    case 'recipe-strategy-unsupported':
    case 'recipe-static-transform':
    case 'plugin-not-from-recipe':
    case 'recipe-changed':
    case 'archive-not-zip':
    case 'archive-not-configuration':
    case 'archive-schema-version':
    case 'archive-record-refused':
    case 'palette-name-taken':
    case 'palette-not-custom':
    case 'palette-in-use':
    case 'conflict':
    case 'payload-too-large':
    case 'unprocessable':
      return 'The server refused.'
    case 'bad-gateway':
    case 'upstream-unreachable':
    case 'notification-failed':
    case 'service-unavailable':
    case 'internal':
      return 'The server failed.'
    default: {
      const unhandled: never = code
      return unhandled
    }
  }
}

describe('the ApiErrorCode union', () => {
  it('has a wording for every code, in a table and in a switch', () => {
    expect(Object.keys(wording).sort()).toEqual([...API_ERROR_CODES].sort())
    API_ERROR_CODES.forEach(code => expect(wordingBySwitch(code)).toEqual(expect.any(String)))
  })

  it('refuses a wording table that misses a code at type-check', () => {
    const { internal: _internal, ...withoutInternal } = wording
    // @ts-expect-error 'internal' has no wording
    const incomplete: Record<ApiErrorCode, string> = withoutInternal
    expect(incomplete).not.toHaveProperty('internal')
  })

  it('lists each code once, in kebab-case', () => {
    expect(new Set(API_ERROR_CODES).size).toBe(API_ERROR_CODES.length)
    API_ERROR_CODES.forEach(code => expect(code).toMatch(/^[a-z]+(?:-[a-z]+)*$/))
  })
})
