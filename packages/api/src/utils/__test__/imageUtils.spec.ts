import type { Logger } from '@nestjs/common'
import { Buffer } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { convertToPng, downloadImage, paletteConversion } from '../imageUtils'

const mockExec = vi.fn()
const mockFd = {
  read: vi.fn().mockImplementation((buf: any) => {
    buf[0] = 0xFF
    buf[1] = 0xD8
    buf[2] = 0xFF
    return Promise.resolve()
  }),
  close: vi.fn().mockResolvedValue(undefined),
}
const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(),
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    open: vi.fn(),
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
    mockFs.promises.open.mockResolvedValue(mockFd)
    mockFd.read.mockImplementation((buf: any) => {
      buf[0] = 0xFF
      buf[1] = 0xD8
      buf[2] = 0xFF
      return Promise.resolve()
    })
    mockFd.close.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  const OG_PLUS = { name: 'og_plus', width: 800, height: 480, rotation: 0, offsetX: 0, offsetY: 0 } as any
  const GRAY_4 = { id: 'gray-4', grays: 4, colors: null, frameworkClass: 'screen--2bit' } as any
  const BW = { id: 'bw', grays: 2, colors: null, frameworkClass: 'screen--1bit' } as any
  const GRAY_16 = { id: 'gray-16', grays: 16, colors: null, frameworkClass: 'screen--4bit' } as any
  const COLOR_6A = { id: 'color-6a', grays: 2, colors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#000000', '#FFFFFF'], frameworkClass: 'screen--color-6a' } as any
  const COLOR_24 = { id: 'color-24bit', grays: 2, colors: null, frameworkClass: 'screen--color-full' } as any

  function magickSucceeds() {
    mockExec.mockImplementation((cmd: string, callback: any) => {
      callback(null, '', '')
    })
  }

  describe('paletteConversion', () => {
    it('maps gray palettes to a bit depth', () => {
      expect(paletteConversion(BW)).toEqual({ kind: 'gray', levels: 2, bitDepth: 1 })
      expect(paletteConversion(GRAY_4)).toEqual({ kind: 'gray', levels: 4, bitDepth: 2 })
      expect(paletteConversion(GRAY_16)).toEqual({ kind: 'gray', levels: 16, bitDepth: 4 })
      expect(paletteConversion({ id: 'gray-256', grays: 256, colors: null, frameworkClass: 'screen--4bit' } as any)).toEqual({ kind: 'gray', levels: 256, bitDepth: 8 })
    })

    it('maps colour palettes to their colour list and full-colour palettes to untouched colour', () => {
      expect(paletteConversion(COLOR_6A)).toEqual({ kind: 'color', colors: COLOR_6A.colors })
      expect(paletteConversion(COLOR_24)).toEqual({ kind: 'full-color' })
    })
  })

  describe('convertToPng', () => {
    it('creates the gray colormap for the palette if it does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false)
      magickSucceeds()

      await convertToPng('/input.jpg', '/output.png', { model: OG_PLUS, palette: GRAY_4 }, mockLogger)

      expect(mockFs.promises.mkdir).toHaveBeenCalled()
      expect(mockExec).toHaveBeenCalledTimes(2)
      expect(mockExec.mock.calls[0][0]).toContain('xc:"#000000" xc:"#555555" xc:"#aaaaaa" xc:"#ffffff" +append -type Palette')
      expect(mockExec.mock.calls[0][0]).toContain('colormaps/gray-4.png')
    })

    it('creates a colormap from the palette colours for colour panels', async () => {
      mockFs.existsSync.mockReturnValue(false)
      magickSucceeds()

      await convertToPng('/input.jpg', '/output.png', { model: OG_PLUS, palette: COLOR_6A }, mockLogger)

      expect(mockExec.mock.calls[0][0]).toContain('xc:"#FF0000" xc:"#00FF00" xc:"#0000FF" xc:"#FFFF00" xc:"#000000" xc:"#FFFFFF" +append')
      expect(mockExec.mock.calls[0][0]).toContain('colormaps/color-6a.png')
      const cmd = mockExec.mock.calls[1][0]
      expect(cmd).toContain('-remap')
      expect(cmd).toContain('-define png:color-type=3')
      expect(cmd).not.toContain('-colorspace Gray')
    })

    it('skips colormap creation if it already exists', async () => {
      mockFs.existsSync.mockReturnValue(true)
      magickSucceeds()

      await convertToPng('/input.jpg', '/output.png', { model: OG_PLUS, palette: GRAY_4 }, mockLogger)

      expect(mockExec).toHaveBeenCalledTimes(1)
    })

    it('calls ImageMagick with 2-bit gray parameters for the 4-gray palette', async () => {
      mockFs.existsSync.mockReturnValue(true)
      magickSucceeds()

      await convertToPng('/input.jpg', '/output.png', { model: OG_PLUS, palette: GRAY_4 }, mockLogger)

      const cmd = mockExec.mock.calls[0][0]
      expect(cmd).toContain('magick "JPEG:/input.jpg"')
      expect(cmd).toContain('-background white -alpha remove -alpha off')
      expect(cmd).toContain('-resize 800x480 -gravity Center -extent 800x480')
      expect(cmd).toContain('-colorspace Gray -dither FloydSteinberg -remap')
      expect(cmd).toContain('colormaps/gray-4.png')
      expect(cmd).toContain('-define png:bit-depth=2 -define png:color-type=0')
      expect(cmd).toContain('-strip png:"/output.png"')
      expect(cmd).not.toContain('-rotate')
      expect(cmd).not.toContain('-crop')
    })

    it('uses 1-bit and 4-bit output for the bw and 16-gray palettes', async () => {
      mockFs.existsSync.mockReturnValue(true)
      magickSucceeds()

      await convertToPng('/input.jpg', '/output.png', { model: OG_PLUS, palette: BW }, mockLogger)
      expect(mockExec.mock.calls[0][0]).toContain('-define png:bit-depth=1')
      await convertToPng('/input.jpg', '/output.png', { model: OG_PLUS, palette: GRAY_16 }, mockLogger)
      expect(mockExec.mock.calls[1][0]).toContain('-define png:bit-depth=4')
    })

    it('keeps full colour for full-colour palettes without remapping', async () => {
      magickSucceeds()

      await convertToPng('/input.jpg', '/output.png', { model: OG_PLUS, palette: COLOR_24 }, mockLogger)

      expect(mockExec).toHaveBeenCalledTimes(1)
      const cmd = mockExec.mock.calls[0][0]
      expect(cmd).toContain('-colorspace sRGB -define png:color-type=2')
      expect(cmd).not.toContain('-remap')
    })

    it('fits to the model size, then rotates and trims offsets', async () => {
      mockFs.existsSync.mockReturnValue(true)
      magickSucceeds()
      const kindle = { ...OG_PLUS, name: 'kindle', width: 1400, height: 840, rotation: 90, offsetX: 75, offsetY: 25 }

      await convertToPng('/input.jpg', '/output.png', { model: kindle, palette: GRAY_4 }, mockLogger)

      const cmd = mockExec.mock.calls[0][0]
      expect(cmd).toContain('-resize 1400x840 -gravity Center -extent 1400x840 -rotate 90 -crop +75+25 +repage -colorspace Gray')
    })

    it('handles ImageMagick errors during colormap creation', async () => {
      mockFs.existsSync.mockReturnValue(false)
      mockExec.mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('colormap')) {
          callback(new Error('ImageMagick failed'), '', 'ImageMagick error')
        }
      })

      await expect(convertToPng('/input.jpg', '/output.png', { model: OG_PLUS, palette: GRAY_4 }, mockLogger))
        .rejects
        .toThrow('ImageMagick failed')

      expect(mockLogger.error).toHaveBeenCalledWith('ImageMagick error: ImageMagick error')
    })

    it('handles ImageMagick errors during conversion', async () => {
      mockFs.existsSync.mockReturnValue(true)
      mockExec.mockImplementation((cmd: string, callback: any) => {
        callback(new Error('Conversion failed'), '', 'conversion stderr')
      })

      await expect(convertToPng('/input.jpg', '/output.png', { model: OG_PLUS, palette: GRAY_4 }, mockLogger))
        .rejects
        .toThrow('Conversion failed')
    })

    it('rejects unknown image formats', async () => {
      mockFd.read.mockImplementation((buf: any) => {
        buf[0] = 0x00
        buf[1] = 0x01
        return Promise.resolve()
      })
      await expect(convertToPng('/input.bin', '/output.png', { model: OG_PLUS, palette: GRAY_4 }, mockLogger))
        .rejects
        .toThrow('Unsupported or unrecognised image format')
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
