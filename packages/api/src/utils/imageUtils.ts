import type { Logger } from '@nestjs/common'
import buffer from 'node:buffer'
import { exec } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

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

export async function convertToMonochromeBmp(inputPath: string, outputPath: string, width: number, height: number, logger: Logger) {
  return new Promise<void>((resolve, reject) => {
    const cmd = `magick "${inputPath}" -background white -resize ${width}x${height} -gravity Center -extent ${width}x${height} -monochrome -colors 2 -depth 1 -strip bmp3:"${outputPath}"`
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
