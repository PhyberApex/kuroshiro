import { describe, expect, it } from 'vitest'
import { errorMessage } from '../errorMessage'

describe('errorMessage', () => {
  it('reads the message off an Error', () => {
    expect(errorMessage(new Error('Failed to fetch'), 'fallback')).toBe('Failed to fetch')
  })

  it('falls back for a non-Error thrown value', () => {
    expect(errorMessage('a plain string', 'fallback')).toBe('fallback')
    expect(errorMessage(undefined, 'fallback')).toBe('fallback')
  })

  it('falls back for an Error with an empty message', () => {
    const emptyError = new Error('placeholder')
    emptyError.message = ''
    expect(errorMessage(emptyError, 'fallback')).toBe('fallback')
  })
})
