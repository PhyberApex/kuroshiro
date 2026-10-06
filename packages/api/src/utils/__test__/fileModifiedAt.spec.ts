import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fileModifiedAt } from '../fileModifiedAt.js'

const fs = vi.hoisted(() => ({
  promises: {
    stat: vi.fn(),
  },
}))

vi.mock('node:fs', () => fs)

describe('fileModifiedAt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('reads the mtime off the filesystem', async () => {
    const mtime = new Date('2026-08-20T00:00:00.000Z')
    fs.promises.stat.mockResolvedValueOnce({ mtime })

    const result = await fileModifiedAt('/path/to/file')

    expect(result).toBe(mtime)
    expect(fs.promises.stat).toHaveBeenCalledWith('/path/to/file')
  })
})
