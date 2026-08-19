import type { Logger } from '@nestjs/common'
import type { DeviceRenderTarget } from '../device-models/device-models.service'
import type { DeviceModel } from '../device-models/entities/device-model.entity'
import type { Palette } from '../device-models/entities/palette.entity'
import buffer from 'node:buffer'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { resolveAppPath } from './pathHelper'

// Maps magic-byte signatures to the ImageMagick format prefix used when invoking magick.
// Only raster image formats that make sense on an e-ink display are permitted.
const MAGIC_BYTES: Array<{ bytes: number[], format: string }> = [
  { bytes: [0xFF, 0xD8, 0xFF], format: 'JPEG' },
  { bytes: [0x89, 0x50, 0x4E, 0x47], format: 'PNG' },
  { bytes: [0x47, 0x49, 0x46], format: 'GIF' },
  { bytes: [0x42, 0x4D], format: 'BMP' },
  { bytes: [0x49, 0x49, 0x2A, 0x00], format: 'TIFF' },
  { bytes: [0x4D, 0x4D, 0x00, 0x2A], format: 'TIFF' },
  { bytes: [0x52, 0x49, 0x46, 0x46], format: 'WEBP' },
]

const FULL_COLOR_FRAMEWORK_CLASS = 'screen--color-full'

function detectImageFormat(buf: buffer.Buffer): string {
  for (const { bytes, format } of MAGIC_BYTES) {
    if (bytes.every((b, i) => buf[i] === b))
      return format
  }
  throw new Error('Unsupported or unrecognised image format')
}

export async function downloadImage(url: string, dest: string, logger: Logger) {
  logger.log(`Downloading image from ${url} to ${dest}`)
  const res = await fetch(url)
  if (!res.ok)
    throw new Error(`Failed to fetch image: ${res.statusText}`)
  const imgBuffer = buffer.Buffer.from(await res.arrayBuffer())
  await fs.promises.mkdir(path.dirname(dest), { recursive: true })
  await fs.promises.writeFile(dest, imgBuffer)
  logger.log(`Image downloaded to ${dest}`)
}

export type PaletteConversion
  = | { kind: 'gray', levels: number, bitDepth: number }
    | { kind: 'color', colors: string[] }
    | { kind: 'full-color' }

/** How a palette maps onto ImageMagick's output: quantised grays, a fixed colour set, or untouched colour. */
export function paletteConversion(palette: Pick<Palette, 'grays' | 'colors' | 'frameworkClass'>): PaletteConversion {
  if (palette.frameworkClass === FULL_COLOR_FRAMEWORK_CLASS)
    return { kind: 'full-color' }
  if (palette.colors && palette.colors.length > 0)
    return { kind: 'color', colors: palette.colors }
  const levels = Math.max(2, palette.grays)
  return { kind: 'gray', levels, bitDepth: Math.max(1, Math.ceil(Math.log2(levels))) }
}

function grayLevelsHex(levels: number): string[] {
  return Array.from({ length: levels }, (_, i) => {
    const value = Math.round((i * 255) / (levels - 1)).toString(16).padStart(2, '0')
    return `#${value}${value}${value}`
  })
}

function runMagick(args: string[], logger: Logger): Promise<void> {
  logger.log(`Running ImageMagick: magick ${args.join(' ')}`)
  return new Promise<void>((resolve, reject) => {
    execFile('magick', args, (error, stdout, stderr) => {
      if (error) {
        logger.error(`ImageMagick error: ${stderr}`)
        reject(error)
      }
      else {
        logger.log(`ImageMagick output: ${stdout}`)
        resolve()
      }
    })
  })
}

async function ensureColormap(paletteId: string, colors: string[], logger: Logger): Promise<string> {
  const colormapPath = resolveAppPath('public', 'colormaps', `${paletteId}.png`)
  if (fs.existsSync(colormapPath))
    return colormapPath
  logger.log(`Creating colormap for palette ${paletteId} at ${colormapPath}`)
  await fs.promises.mkdir(path.dirname(colormapPath), { recursive: true })
  const swatches = colors.map(color => `xc:${color}`)
  await runMagick(['-size', '1x1', ...swatches, '+append', '-type', 'Palette', colormapPath], logger)
  return colormapPath
}

async function paletteOperators(palette: Palette, logger: Logger): Promise<string[]> {
  const conversion = paletteConversion(palette)
  switch (conversion.kind) {
    case 'gray': {
      const colormap = await ensureColormap(palette.id, grayLevelsHex(conversion.levels), logger)
      return ['-colorspace', 'Gray', '-dither', 'FloydSteinberg', '-remap', colormap, '-define', `png:bit-depth=${conversion.bitDepth}`, '-define', 'png:color-type=0']
    }
    case 'color': {
      const colormap = await ensureColormap(palette.id, conversion.colors, logger)
      // -modulate brightness,saturation: pushed colours past the thresholds the firmware
      // uses to tell red/yellow apart from gray (see docs/adr/0002-color-palette-png-format.md)
      const saturationBoost = '110,150'
      return ['-normalize', '-modulate', saturationBoost, '-colorspace', 'RGB', '-dither', 'FloydSteinberg', '-remap', colormap, '-colorspace', 'sRGB', '-define', 'png:color-type=3']
    }
    case 'full-color':
      return ['-colorspace', 'sRGB', '-define', 'png:color-type=2']
  }
}

/** The panel's pixel dimensions once rotated — 90/270 swap width and height. */
function rotatedSize(model: Pick<DeviceModel, 'width' | 'height' | 'rotation'>): string {
  const swapped = model.rotation === 90 || model.rotation === 270
  return swapped ? `${model.height}x${model.width}` : `${model.width}x${model.height}`
}

/**
 * Geometry for a render target: fit into the model's canvas (letterboxed on
 * white), rotate to the panel's orientation, then shift the model's offset
 * out of the top-left corner and re-extend to the full (rotated) canvas so
 * the output always matches the panel's pixel dimensions — offsetting crops
 * content rather than shrinking the frame.
 */
function geometryOperators({ model }: DeviceRenderTarget): string[] {
  const size = `${model.width}x${model.height}`
  const ops = ['-resize', size, '-gravity', 'Center', '-extent', size]
  if (model.rotation !== 0)
    ops.push('-rotate', String(model.rotation))
  if (model.offsetX !== 0 || model.offsetY !== 0)
    ops.push('-crop', `+${model.offsetX}+${model.offsetY}`, '+repage', '-gravity', 'NorthWest', '-extent', rotatedSize(model))
  return ops
}

/** Converts any supported raster image into the PNG a device with the given render target expects. */
export async function convertToPng(inputPath: string, outputPath: string, target: DeviceRenderTarget, logger: Logger) {
  const header = buffer.Buffer.allocUnsafe(8)
  const fd = await fs.promises.open(inputPath, 'r')
  try {
    await fd.read(header, 0, 8, 0)
  }
  finally {
    await fd.close()
  }
  const format = detectImageFormat(header)
  const palette = await paletteOperators(target.palette, logger)

  const args = [
    `${format}:${inputPath}`,
    '-background',
    'white',
    '-alpha',
    'remove',
    '-alpha',
    'off',
    ...geometryOperators(target),
    ...palette,
    '-strip',
    `png:${outputPath}`,
  ]
  await runMagick(args, logger)
}
