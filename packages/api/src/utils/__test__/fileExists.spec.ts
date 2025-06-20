import { fileExists } from 'src/utils/fileExists'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fs = vi.hoisted(() => ({
  promises: {
    access: vi.fn(),
  },
}))

vi.mock('node:fs', () => fs)

describe('fileExists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('returns true when file exists', async () => {
    fs.promises.access.mockResolvedValueOnce(undefined)
    const result = await fileExists('/path/to/existing/file')
    expect(result).toBe(true)
    expect(fs.promises.access).toHaveBeenCalledWith('/path/to/existing/file')
  })

  it('returns false when file does not exist', async () => {
    fs.promises.access.mockRejectedValueOnce(new Error('File not found'))
    const result = await fileExists('/path/to/non/existing/file')
    expect(result).toBe(false)
    expect(fs.promises.access).toHaveBeenCalledWith('/path/to/non/existing/file')
  })
})
