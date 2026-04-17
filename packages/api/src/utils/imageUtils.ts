import type { Logger } from '@nestjs/common'
import buffer from 'node:buffer'
import { exec } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

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

async function ensureColormapExists(colormapPath: string, logger: Logger): Promise<void> {
  if (fs.existsSync(colormapPath)) {
    logger.log(`Colormap already exists at ${colormapPath}`)
    return
  }

  logger.log(`Creating 2-bit colormap at ${colormapPath}`)
  await fs.promises.mkdir(path.dirname(colormapPath), { recursive: true })

  return new Promise<void>((resolve, reject) => {
    const cmd = `magick -size 4x1 xc:#000000 xc:#555555 xc:#aaaaaa xc:#ffffff +append -type Palette "${colormapPath}"`
    logger.log(`Running ImageMagick: ${cmd}`)
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        logger.error(`ImageMagick error: ${stderr}`)
        reject(error)
      }
      else {
        logger.log(`Colormap created successfully`)
        resolve()
      }
    })
  })
}

export async function convertToPng(inputPath: string, outputPath: string, width: number, height: number, logger: Logger) {
  const colormapPath = path.join(process.cwd(), 'public/colormap-2bit.png')

  await ensureColormapExists(colormapPath, logger)

  return new Promise<void>((resolve, reject) => {
    const cmd = `magick "${inputPath}" -resize ${width}x${height} -gravity Center -extent ${width}x${height} -dither FloydSteinberg -remap "${colormapPath}" -define png:bit-depth=2 -define png:color-type=0 -strip png:"${outputPath}"`
    logger.log(`Running ImageMagick: ${cmd}`)
    exec(cmd, (error, stdout, stderr) => {
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
