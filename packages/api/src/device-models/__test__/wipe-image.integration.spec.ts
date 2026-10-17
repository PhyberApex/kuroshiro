import type { Logger } from '@nestjs/common'
import { execFile, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { makeDeviceModel, makePalette } from '../../test/fixtures.js'
import { asService } from '../../test/mockService.js'
import { convertBlankToPng } from '../../utils/imageUtils.js'

const execFileAsync = promisify(execFile)

function magickAvailable(): boolean {
  try {
    execFileSync('magick', ['--version'])
    return true
  }
  catch {
    return false
  }
}

describe.runIf(magickAvailable())('the Wipe image (real magick)', () => {
  let tmpDir: string
  const logger = asService<Logger>({ log: () => {}, error: () => {} })

  beforeAll(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'kuroshiro-wipe-'))
  })

  afterAll(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true })
  })

  it('is uniformly white in the Device Model\'s size', async () => {
    const outputPath = path.join(tmpDir, 'wipe.png')
    const palette = makePalette({ id: 'bw', grays: 2, colors: null, frameworkClass: 'screen--1bit' })

    await convertBlankToPng(outputPath, { model: makeDeviceModel({ name: 'og', width: 800, height: 480 }), palette }, logger)

    const { stdout } = await execFileAsync('magick', ['identify', '-format', '%wx%h %[fx:minima] %[fx:maxima]', outputPath])
    expect(stdout).toBe('800x480 1 1')
  })
})
