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
}

function wordingBySwitch(code: ApiErrorCode): string {
  switch (code) {
    case 'validation':
    case 'bad-request':
      return 'Check what you sent.'
    case 'forbidden':
    case 'not-found':
    case 'device-not-found':
    case 'conflict':
    case 'payload-too-large':
    case 'unprocessable':
      return 'The server refused.'
    case 'bad-gateway':
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
