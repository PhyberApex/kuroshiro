import { promises as fs } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fileExists } from '../fileExists'

vi.mock('node:fs', () => ({
  promises: {
    access: vi.fn(),
  },
}))

describe('fileExists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('returns true when file exists', async () => {
    vi.mocked(fs.access).mockResolvedValueOnce()
    const result = await fileExists('/path/to/existing/file')
    expect(result).toBe(true)
    expect(fs.access).toHaveBeenCalledWith('/path/to/existing/file')
  })

  it('returns false when file does not exist', async () => {
    vi.mocked(fs.access).mockRejectedValueOnce(new Error('File not found'))
    const result = await fileExists('/path/to/non/existing/file')
    expect(result).toBe(false)
    expect(fs.access).toHaveBeenCalledWith('/path/to/non/existing/file')
  })
})
