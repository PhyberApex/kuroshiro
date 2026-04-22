import type { Logger } from '@nestjs/common'
import { Buffer } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { convertToPng, downloadImage } from '../imageUtils'

const mockExec = vi.fn()
const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(),
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
  },
}))

vi.mock('node:child_process', () => ({
  exec: (cmd: string, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
    mockExec(cmd, callback)
  },
}))

vi.mock('node:fs', () => ({
  default: mockFs,
  ...mockFs,
}))

describe('imageUtils', () => {
  let mockLogger: Logger

  beforeEach(() => {
    vi.clearAllMocks()
    mockLogger = {
      log: vi.fn(),
      error: vi.fn(),
    } as unknown as Logger
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('convertToPng', () => {
    it('creates colormap if it does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false)
      mockExec.mockImplementation((cmd: string, callback: any) => {
        callback(null, '', '')
      })

      await convertToPng('/input.jpg', '/output.png', 800, 480, mockLogger)

      expect(mockFs.existsSync)
        .toHaveBeenCalled()
      expect(mockFs.promises.mkdir).toHaveBeenCalled()
      expect(mockExec).toHaveBeenCalledTimes(2)
      expect(mockExec.mock.calls[0][0]).toContain('xc:#000000 xc:#555555 xc:#aaaaaa xc:#ffffff')
      expect(mockExec.mock.calls[0][0]).toContain('+append -type Palette')
    })

    it('skips colormap creation if it already exists', async () => {
      mockFs.existsSync.mockReturnValue(true)
      mockExec.mockImplementation((cmd: string, callback: any) => {
        callback(null, '', '')
      })

      await convertToPng('/input.jpg', '/output.png', 800, 480, mockLogger)

      expect(mockFs.existsSync)
        .toHaveBeenCalled()
      expect(mockFs.promises.mkdir).not.toHaveBeenCalled()
      expect(mockExec).toHaveBeenCalledTimes(1)
    })

    it('calls ImageMagick with correct 2-bit PNG parameters', async () => {
      mockFs.existsSync.mockReturnValue(true)
      mockExec.mockImplementation((cmd: string, callback: any) => {
        callback(null, '', '')
      })

      await convertToPng('/input.jpg', '/output.png', 800, 480, mockLogger)

      expect(mockExec).toHaveBeenCalledTimes(1)
      const cmd = mockExec.mock.calls[0][0]
      expect(cmd).toContain('-resize 800x480')
      expect(cmd).toContain('-gravity Center')
      expect(cmd).toContain('-extent 800x480')
      expect(cmd).toContain('-dither FloydSteinberg')
      expect(cmd).toContain('-remap')
      expect(cmd).toContain('colormap-2bit.png')
      expect(cmd).toContain('-define png:bit-depth=2')
      expect(cmd).toContain('-define png:color-type=0')
      expect(cmd).toContain('-strip')
      expect(cmd).toContain('png:"/output.png"')
    })

    it('respects dynamic width and height parameters', async () => {
      mockFs.existsSync.mockReturnValue(true)
      mockExec.mockImplementation((cmd: string, callback: any) => {
        callback(null, '', '')
      })

      await convertToPng('/input.jpg', '/output.png', 640, 384, mockLogger)

      const cmd = mockExec.mock.calls[0][0]
      expect(cmd).toContain('-resize 640x384')
      expect(cmd).toContain('-extent 640x384')
    })

    it('handles ImageMagick errors during colormap creation', async () => {
      mockFs.existsSync.mockReturnValue(false)
      mockExec.mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('colormap')) {
          callback(new Error('ImageMagick failed'), '', 'ImageMagick error')
        }
      })

      await expect(convertToPng('/input.jpg', '/output.png', 800, 480, mockLogger))
        .rejects
        .toThrow('ImageMagick failed')

      expect(mockLogger.error).toHaveBeenCalledWith('ImageMagick error: ImageMagick error')
    })

    it('handles ImageMagick errors during conversion', async () => {
      mockFs.existsSync.mockReturnValue(true)
      mockExec.mockImplementation((cmd: string, callback: any) => {
        callback(new Error('Conversion failed'), '', 'Conversion error')
      })

      await expect(convertToPng('/input.jpg', '/output.png', 800, 480, mockLogger))
        .rejects
        .toThrow('Conversion failed')

      expect(mockLogger.error).toHaveBeenCalledWith('ImageMagick error: Conversion error')
    })

    it('logs conversion progress', async () => {
      mockFs.existsSync.mockReturnValue(true)
      mockExec.mockImplementation((cmd: string, callback: any) => {
        callback(null, 'success', '')
      })

      await convertToPng('/input.jpg', '/output.png', 800, 480, mockLogger)

      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Running ImageMagick:'))
      expect(mockLogger.log).toHaveBeenCalledWith('ImageMagick output: success')
    })
  })

  describe('downloadImage', () => {
    const mockFetch = vi.fn()

    beforeEach(() => {
      globalThis.fetch = mockFetch
    })

    it('downloads and saves image successfully', async () => {
      const mockBuffer = Buffer.from('image data')
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: async () => mockBuffer,
      })

      await downloadImage('http://example.com/image.jpg', '/dest/image.jpg', mockLogger)

      expect(mockFetch).toHaveBeenCalledWith('http://example.com/image.jpg')
      expect(mockFs.promises.mkdir).toHaveBeenCalledWith('/dest', { recursive: true })
      expect(mockFs.promises.writeFile).toHaveBeenCalledWith('/dest/image.jpg', expect.any(Buffer))
      expect(mockLogger.log).toHaveBeenCalledWith('Downloading image from http://example.com/image.jpg to /dest/image.jpg')
      expect(mockLogger.log).toHaveBeenCalledWith('Image downloaded to /dest/image.jpg')
    })

    it('throws error when fetch fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      })

      await expect(downloadImage('http://example.com/missing.jpg', '/dest/image.jpg', mockLogger))
        .rejects
        .toThrow('Failed to fetch image: Not Found')
    })
  })
})
