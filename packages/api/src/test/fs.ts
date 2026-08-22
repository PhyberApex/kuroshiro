import type { Dirent, Stats } from 'node:fs'
import * as fs from 'node:fs'
import { vi } from 'vitest'

export function makeStats(overrides: Partial<Pick<Stats, 'size' | 'mtimeMs'>> & { directory?: boolean } = {}): Stats {
  const { directory = false, size = 0, mtimeMs = Date.now() } = overrides
  return {
    isDirectory: () => directory,
    isFile: () => !directory,
    size,
    mtimeMs,
  } as Stats
}

export function makeDirent(name: string, directory = false): Dirent {
  return {
    name,
    isDirectory: () => directory,
    isFile: () => !directory,
  } as Dirent
}

/** The one documented boundary cast: `fs.promises.stat`'s real signature is overloaded on encoding options, which a test stub never varies. */
export function mockStat(impl: (path: string) => Promise<Stats>) {
  return vi.spyOn(fs.promises, 'stat').mockImplementation(impl as unknown as typeof fs.promises.stat)
}

/** The one documented boundary cast: `fs.promises.readdir`'s real signature is overloaded on `withFileTypes`, which a test stub never varies. */
export function mockReaddir(impl: (path: string) => Promise<string[] | Dirent[]>) {
  return vi.spyOn(fs.promises, 'readdir').mockImplementation(impl as unknown as typeof fs.promises.readdir)
}

/** The one documented boundary cast: `Express.Multer.File` carries a dozen disk-storage/stream fields no spec in this codebase reads — only the ones a test provides are populated. */
export function makeMulterFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'upload.bin',
    encoding: '7bit',
    mimetype: 'application/octet-stream',
    size: 0,
    ...overrides,
  } as Express.Multer.File
}
