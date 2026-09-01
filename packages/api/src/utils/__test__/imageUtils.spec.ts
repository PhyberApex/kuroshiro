import type { Logger } from '@nestjs/common'
import { Buffer } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDeviceModel, makePalette } from '../../test/fixtures.js'
import { asService } from '../../test/mockService.js'
import { convertToPng, downloadImage, paletteConversion } from '../imageUtils.js'

type ExecFileCallback = (error: Error | null, stdout: string, stderr: string) => void

const mockExecFile = vi.fn()
const mockFd = {
  read: vi.fn().mockImplementation((buf: Buffer) => {
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
  execFile: (file: string, args: string[], callback: ExecFileCallback) => {
    mockExecFile(file, args, callback)
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
    mockLogger = asService<Logger>({
      log: vi.fn(),
      error: vi.fn(),
    })
    mockFs.promises.open.mockResolvedValue(mockFd)
    mockFd.read.mockImplementation((buf: Buffer) => {
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

  const OG_PLUS = makeDeviceModel({ name: 'og_plus', width: 800, height: 480, rotation: 0, offsetX: 0, offsetY: 0 })
  const GRAY_4 = makePalette({ id: 'gray-4', grays: 4, colors: null, frameworkClass: 'screen--2bit' })
  const BW = makePalette({ id: 'bw', grays: 2, colors: null, frameworkClass: 'screen--1bit' })
  const GRAY_16 = makePalette({ id: 'gray-16', grays: 16, colors: null, frameworkClass: 'screen--4bit' })
  const COLOR_6A = makePalette({ id: 'color-6a', grays: 2, colors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#000000', '#FFFFFF'], frameworkClass: 'screen--color-6a' })
  const COLOR_24 = makePalette({ id: 'color-24bit', grays: 2, colors: null, frameworkClass: 'screen--color-full' })

  function magickSucceeds() {
    mockExecFile.mockImplementation((_file: string, _args: string[], callback: ExecFileCallback) => {
      callback(null, '', '')
    })
  }

  describe('paletteConversion', () => {
    it('maps gray palettes to a bit depth', () => {
      expect(paletteConversion(BW)).toEqual({ kind: 'gray', levels: 2, bitDepth: 1 })
      expect(paletteConversion(GRAY_4)).toEqual({ kind: 'gray', levels: 4, bitDepth: 2 })
      expect(paletteConversion(GRAY_16)).toEqual({ kind: 'gray', levels: 16, bitDepth: 4 })
      expect(paletteConversion(makePalette({ id: 'gray-256', grays: 256, colors: null, frameworkClass: 'screen--4bit' }))).toEqual({ kind: 'gray', levels: 256, bitDepth: 8 })
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
      expect(mockExecFile).toHaveBeenCalledTimes(2)
      expect(mockExecFile.mock.calls[0][0]).toBe('magick')
      expect(mockExecFile.mock.calls[0][1]).toEqual(['-size', '1x1', 'xc:#000000', 'xc:#555555', 'xc:#aaaaaa', 'xc:#ffffff', '+append', '-type', 'Palette', expect.stringContaining('colormaps/gray-4.png')])
    })

    it('creates a colormap from the palette colours for colour panels', async () => {
      mockFs.existsSync.mockReturnValue(false)
      magickSucceeds()

      await convertToPng('/input.jpg', '/output.png', { model: OG_PLUS, palette: COLOR_6A }, mockLogger)

      expect(mockExecFile.mock.calls[0][1]).toEqual(['-size', '1x1', 'xc:#FF0000', 'xc:#00FF00', 'xc:#0000FF', 'xc:#FFFF00', 'xc:#000000', 'xc:#FFFFFF', '+append', '-type', 'Palette', expect.stringContaining('colormaps/color-6a.png')])
      const args = mockExecFile.mock.calls[1][1]
      expect(args).toContain('-remap')
      expect(args).toEqual(expect.arrayContaining(['-define', 'png:color-type=3']))
    })

    it('boosts saturation before remapping colour panels, matching Terminus\'s colour path', async () => {
      mockFs.existsSync.mockReturnValue(true)
      magickSucceeds()

      await convertToPng('/input.jpg', '/output.png', { model: OG_PLUS, palette: COLOR_6A }, mockLogger)

      const args = mockExecFile.mock.calls[0][1]
      expect(args).toEqual(expect.arrayContaining(['-normalize', '-modulate', '110,150', '-colorspace', 'RGB', '-dither', 'FloydSteinberg', '-remap']))
      expect(args).toEqual(expect.arrayContaining(['-colorspace', 'sRGB', '-define', 'png:color-type=3']))
      // saturation boost runs before the remap, and the colourspace is restored to sRGB after it
      expect(args.indexOf('-normalize')).toBeLessThan(args.indexOf('-remap'))
      expect(args.lastIndexOf('-colorspace')).toBeGreaterThan(args.indexOf('-remap'))
    })

    it('skips colormap creation if it already exists', async () => {
      mockFs.existsSync.mockReturnValue(true)
      magickSucceeds()

      await convertToPng('/input.jpg', '/output.png', { model: OG_PLUS, palette: GRAY_4 }, mockLogger)

      expect(mockExecFile).toHaveBeenCalledTimes(1)
    })

    it('calls ImageMagick with 2-bit gray parameters for the 4-gray palette', async () => {
      mockFs.existsSync.mockReturnValue(true)
      magickSucceeds()

      await convertToPng('/input.jpg', '/output.png', { model: OG_PLUS, palette: GRAY_4 }, mockLogger)

      expect(mockExecFile.mock.calls[0][0]).toBe('magick')
      const args = mockExecFile.mock.calls[0][1]
      expect(args[0]).toBe('JPEG:/input.jpg')
      expect(args).toEqual(expect.arrayContaining(['-background', 'white', '-alpha', 'remove', '-alpha', 'off']))
      expect(args).toEqual(expect.arrayContaining(['-resize', '800x480', '-gravity', 'Center', '-extent', '800x480']))
      expect(args).toEqual(expect.arrayContaining(['-colorspace', 'Gray', '-dither', 'FloydSteinberg', '-remap']))
      expect(args.some((a: string) => a.includes('colormaps/gray-4.png'))).toBe(true)
      expect(args).toEqual(expect.arrayContaining(['-define', 'png:bit-depth=2', '-define', 'png:color-type=0']))
      expect(args[args.length - 2]).toBe('-strip')
      expect(args[args.length - 1]).toBe('png:/output.png')
      expect(args).not.toContain('-rotate')
      expect(args).not.toContain('-crop')
    })

    it('uses 1-bit and 4-bit output for the bw and 16-gray palettes', async () => {
      mockFs.existsSync.mockReturnValue(true)
      magickSucceeds()

      await convertToPng('/input.jpg', '/output.png', { model: OG_PLUS, palette: BW }, mockLogger)
      expect(mockExecFile.mock.calls[0][1]).toContain('png:bit-depth=1')
      await convertToPng('/input.jpg', '/output.png', { model: OG_PLUS, palette: GRAY_16 }, mockLogger)
      expect(mockExecFile.mock.calls[1][1]).toContain('png:bit-depth=4')
    })

    it('keeps full colour for full-colour palettes without remapping', async () => {
      magickSucceeds()

      await convertToPng('/input.jpg', '/output.png', { model: OG_PLUS, palette: COLOR_24 }, mockLogger)

      expect(mockExecFile).toHaveBeenCalledTimes(1)
      const args = mockExecFile.mock.calls[0][1]
      expect(args).toEqual(expect.arrayContaining(['-colorspace', 'sRGB', '-define', 'png:color-type=2']))
      expect(args).not.toContain('-remap')
    })

    it('fits to the model size, rotates, then shifts the offset back into a full-canvas frame', async () => {
      mockFs.existsSync.mockReturnValue(true)
      magickSucceeds()
      const kindle = makeDeviceModel({ ...OG_PLUS, name: 'kindle', width: 1400, height: 840, rotation: 90, offsetX: 75, offsetY: 25 })

      await convertToPng('/input.jpg', '/output.png', { model: kindle, palette: GRAY_4 }, mockLogger)

      const args = mockExecFile.mock.calls[0][1]
      expect(args).toEqual(expect.arrayContaining([
        '-resize',
        '1400x840',
        '-gravity',
        'Center',
        '-extent',
        '1400x840',
        '-rotate',
        '90',
        '-crop',
        '+75+25',
        '+repage',
        '-gravity',
        'NorthWest',
        '-extent',
        '840x1400',
      ]))
    })

    it('keeps the offset frame at the unrotated model size when rotation does not swap dimensions', async () => {
      mockFs.existsSync.mockReturnValue(true)
      magickSucceeds()
      const shifted = makeDeviceModel({ ...OG_PLUS, name: 'shifted', width: 1400, height: 840, rotation: 180, offsetX: 10, offsetY: 5 })

      await convertToPng('/input.jpg', '/output.png', { model: shifted, palette: GRAY_4 }, mockLogger)

      const args = mockExecFile.mock.calls[0][1]
      expect(args).toEqual(expect.arrayContaining(['-crop', '+10+5', '+repage', '-gravity', 'NorthWest', '-extent', '1400x840']))
    })

    it('handles ImageMagick errors during colormap creation', async () => {
      mockFs.existsSync.mockReturnValue(false)
      mockExecFile.mockImplementation((_file: string, args: string[], callback: ExecFileCallback) => {
        if (args.some(a => a.includes('colormap'))) {
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
      mockExecFile.mockImplementation((_file: string, _args: string[], callback: ExecFileCallback) => {
        callback(new Error('Conversion failed'), '', 'conversion stderr')
      })

      await expect(convertToPng('/input.jpg', '/output.png', { model: OG_PLUS, palette: GRAY_4 }, mockLogger))
        .rejects
        .toThrow('Conversion failed')
    })

    it('rejects unknown image formats', async () => {
      mockFd.read.mockImplementation((buf: Buffer) => {
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
