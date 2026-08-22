import type { Logger } from '@nestjs/common'
import { execFile, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TRMNL_MODELS_SNAPSHOT } from '../../device-models/data/trmnl-snapshot'
import { makeDeviceModel, makePalette } from '../../test/fixtures'
import { asService } from '../../test/mockService'
import { convertToPng } from '../imageUtils'

const execFileAsync = promisify(execFile)

/** A 90/270 rotation swaps the panel's physical width and height. */
function rotatedDimensions({ width, height, rotation }: { width: number, height: number, rotation: number }) {
  return rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height }
}

// One case per distinct (size, rotation, offset) combination in the offline
// snapshot, so every geometry TRMNL actually ships is exercised, not just
// the amazon_kindle_2024/offset case.
const snapshotGeometries = Array.from(
  new Map(
    TRMNL_MODELS_SNAPSHOT.map(m => [
      `${m.width}x${m.height}@${m.rotation}+${m.offset_x}+${m.offset_y}`,
      makeDeviceModel({ name: m.name, width: m.width, height: m.height, rotation: m.rotation, offsetX: m.offset_x, offsetY: m.offset_y }),
    ]),
  ).values(),
)

function magickAvailable(): boolean {
  try {
    execFileSync('magick', ['--version'])
    return true
  }
  catch {
    return false
  }
}

// amazon_kindle_2024 from the TRMNL snapshot: the one model with a non-zero
// offset, and the case #751 found producing an undersized output.
const KINDLE_MODEL = makeDeviceModel({
  name: 'amazon_kindle_2024',
  width: 1400,
  height: 840,
  rotation: 90,
  offsetX: 75,
  offsetY: 25,
})

const GRAY_256 = makePalette({ id: 'gray-256', grays: 256, colors: null, frameworkClass: 'screen--8bit' })

describe.runIf(magickAvailable())('convertToPng (real magick)', () => {
  let tmpDir: string
  let inputPath: string
  let outputPath: string
  const logger = asService<Logger>({ log: () => {}, error: () => {} })

  beforeAll(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'kuroshiro-imageutils-'))
    inputPath = path.join(tmpDir, 'input.png')
    outputPath = path.join(tmpDir, 'output.png')
    await execFileAsync('magick', ['-size', '1400x840', 'xc:red', inputPath])
  })

  afterAll(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true })
  })

  it('produces an output at the model\'s rotated dimensions for a model with an offset', async () => {
    await convertToPng(inputPath, outputPath, { model: KINDLE_MODEL, palette: GRAY_256 }, logger)

    const { stdout } = await execFileAsync('magick', ['identify', '-format', '%wx%h', outputPath])
    expect(stdout).toBe('840x1400')
  })

  it.each(snapshotGeometries)('renders $name at its rotated model dimensions', async (model) => {
    const { width, height } = rotatedDimensions(model)

    await convertToPng(inputPath, outputPath, { model, palette: GRAY_256 }, logger)

    const { stdout } = await execFileAsync('magick', ['identify', '-format', '%wx%h', outputPath])
    expect(stdout).toBe(`${width}x${height}`)
  })
})
