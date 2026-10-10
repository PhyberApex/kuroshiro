import type { CleanupResult, DeletedDeviceFolderFinding, MissingImageFinding, StorageCheck, StorageFinding, StoredFileFinding } from 'kuroshiro-shared'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { DeviceModelsService } from '../device-models/device-models.service.js'
import { FALLBACK_SCREEN_TEMPLATE_VERSION } from '../device-models/fallback-screen-templates.js'
import { Device } from '../devices/devices.entity.js'
import { Screen } from '../screens/screens.entity.js'
import { ScreensService } from '../screens/screens.service.js'
import { fileExists } from '../utils/fileExists.js'
import { getErrorMessage } from '../utils/getErrorMessage.js'
import { resolveAppPath } from '../utils/pathHelper.js'

interface StoredFile {
  name: string
  /** Below the storage folder, with forward slashes whatever the platform. */
  path: string
  bytes: number
  modifiedAtMs: number
}

interface DeviceFolder {
  deviceId: string
  path: string
  /** Every file below the folder, for the totals. */
  files: StoredFile[]
  /** The files directly in it, which is where a Screen's images and a render's temporary files are written. */
  ownFiles: StoredFile[]
}

const DEVICES_FOLDER = 'devices'
const UPLOADS_FOLDER = 'uploads'
const FALLBACK_FOLDER = 'fallback'

const SYSTEM_FILES = new Set([
  'noScreen.png',
  'error.png',
  'welcome.png',
  'sleep.png',
  'colormap-2bit.png',
])

const TEMP_FILE_THRESHOLD_MS = 24 * 60 * 60 * 1000

const NO_LONGER_FOUND = 'No longer found.'

/** Derived from what the finding is and never from when it was found, so a cleanup can name what a check listed. */
function findingId(group: StorageFinding['group'], key: string): string {
  return `${group}:${key}`
}

function isTempFile(filename: string): boolean {
  return filename.endsWith('-source') || filename.startsWith('tmp-')
}

function isScreenImage(filename: string): boolean {
  return filename.endsWith('.png') || filename.endsWith('.original')
}

function byPath<T extends { path: string }>(a: T, b: T): number {
  return a.path.localeCompare(b.path)
}

function toFileFinding(group: StoredFileFinding['group'], file: StoredFile): StoredFileFinding {
  return { id: findingId(group, file.path), group, path: file.path, bytes: file.bytes }
}

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name)

  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    @InjectRepository(Screen)
    private screenRepository: Repository<Screen>,
    private readonly screensService: ScreensService,
    private readonly deviceModelsService: DeviceModelsService,
  ) {}

  /** The stored-files check: what the storage folders hold that nothing uses, and the Screens whose stored image is gone. */
  async scan(): Promise<StorageCheck> {
    this.logger.log('Starting the stored-files check')

    const devices = await this.deviceRepository.find()
    const screens = await this.screenRepository.find({ relations: { device: true } })
    const folders = await this.listDeviceFolders()
    const deviceIds = new Set(devices.map(device => device.id))
    const known = folders.filter(folder => deviceIds.has(folder.deviceId))
    const deleted = folders.filter(folder => !deviceIds.has(folder.deviceId))
    const oldEnough = (file: StoredFile) => Date.now() - file.modifiedAtMs > TEMP_FILE_THRESHOLD_MS

    const findings: StorageFinding[] = [
      ...known.flatMap(folder => this.unusedImagesOf(folder, screens)).sort(byPath),
      ...deleted.map(folder => this.toDeletedDeviceFolderFinding(folder)).sort(byPath),
      ...known.flatMap(folder => folder.ownFiles.filter(file => isTempFile(file.name) && oldEnough(file)).map(file => toFileFinding('tempFile', file))).sort(byPath),
      ...(await this.listFiles(resolveAppPath(UPLOADS_FOLDER), UPLOADS_FOLDER)).filter(oldEnough).map(file => toFileFinding('oldUpload', file)).sort(byPath),
      ...(await this.findOldFallbackRenders(devices)).sort(byPath),
      ...await this.findScreensMissingTheirImage(screens),
    ]

    this.logger.log(`Stored-files check complete. ${findings.length} finding(s)`)

    const named = new Set(findings.flatMap(finding => 'path' in finding ? [finding.path] : []))
    const stored = known.flatMap(folder => folder.files).filter(file => !named.has(file.path))
    return {
      checkedAt: new Date().toISOString(),
      screenImages: { files: stored.length, bytes: stored.reduce((sum, file) => sum + file.bytes, 0) },
      findings,
    }
  }

  /**
   * Removes the findings named by id. It runs the check again and acts only
   * on what that check holds, so nothing a request invents (a path, a Screen's
   * id) is ever deleted: an id the check does not hold comes back in `failed`.
   */
  async cleanup(findingIds: string[]): Promise<CleanupResult> {
    this.logger.log(`Starting cleanup of ${findingIds.length} finding(s)`)

    const { findings } = await this.scan()
    const found = new Map(findings.map(finding => [finding.id, finding]))
    const result: CleanupResult = { removed: { files: 0, folders: 0, screens: 0, bytes: 0 }, failed: [] }

    for (const id of new Set(findingIds)) {
      const finding = found.get(id)
      if (!finding) {
        result.failed.push({ findingId: id, reason: NO_LONGER_FOUND })
        continue
      }
      try {
        await this.remove(finding, result.removed)
      }
      catch (err) {
        this.logger.error(`Failed to remove ${id}: ${getErrorMessage(err)}`)
        result.failed.push({ findingId: id, reason: this.whyNotRemoved(err) })
      }
    }

    const { files, folders, screens, bytes } = result.removed
    this.logger.log(`Cleanup complete. Removed ${files} files, ${folders} folders, ${screens} screens. Freed ${bytes} bytes`)

    return result
  }

  private async remove(finding: StorageFinding, removed: CleanupResult['removed']): Promise<void> {
    if (finding.group === 'missingImage') {
      await this.screensService.delete(finding.screen.id)
      removed.screens++
      return
    }

    if (finding.group === 'deletedDeviceFolder') {
      await fs.promises.rm(this.storedAt(finding.path), { recursive: true })
      removed.folders++
    }
    else {
      await fs.promises.unlink(this.storedAt(finding.path))
      removed.files++
      if (finding.group === 'oldFallbackRender')
        removed.folders += await this.removeEmptyAncestors(this.storedAt(finding.path))
    }
    removed.bytes += finding.bytes
    this.logger.log(`Removed ${finding.path}`)
  }

  /** Removes the folders a removed file leaves empty, up to (not including) the storage folder itself. */
  private async removeEmptyAncestors(filePath: string): Promise<number> {
    const stopAt = resolveAppPath('public', 'screens')
    let removed = 0
    let folder = path.dirname(filePath)
    while (folder !== stopAt) {
      const entries = await fs.promises.readdir(folder).catch(() => null)
      if (entries === null || entries.length > 0)
        break
      await fs.promises.rmdir(folder).catch(() => {})
      removed++
      folder = path.dirname(folder)
    }
    return removed
  }

  /** Worded without the error's own message, which names the absolute path. */
  private whyNotRemoved(err: unknown): string {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT')
      return NO_LONGER_FOUND
    return typeof code === 'string' ? `The server could not delete it (${code}).` : 'The server could not delete it.'
  }

  /** The absolute path of a finding's path, which only ever comes from this service's own scan. */
  private storedAt(findingPath: string): string {
    const segments = findingPath.split('/')
    return segments[0] === UPLOADS_FOLDER ? resolveAppPath(...segments) : resolveAppPath('public', 'screens', ...segments)
  }

  private unusedImagesOf(folder: DeviceFolder, screens: Screen[]): StoredFileFinding[] {
    const screenIds = new Set(screens.filter(screen => screen.device.id === folder.deviceId).map(screen => screen.id))
    return folder.ownFiles
      .filter(file => isScreenImage(file.name) && file.name !== 'mirror.png' && !SYSTEM_FILES.has(file.name) && !isTempFile(file.name))
      .filter(file => !screenIds.has(file.name.replace(/\.(png|original)$/, '')))
      .map(file => toFileFinding('unusedImage', file))
  }

  private toDeletedDeviceFolderFinding(folder: DeviceFolder): DeletedDeviceFolderFinding {
    return {
      id: findingId('deletedDeviceFolder', folder.path),
      group: 'deletedDeviceFolder',
      path: folder.path,
      bytes: folder.files.reduce((sum, file) => sum + file.bytes, 0),
      files: folder.files.length,
    }
  }

  /**
   * Only a Screen that keeps a stored image can miss it: a File Screen. A
   * Plugin Screen, a Mashup and an HTML Screen render on demand, and an
   * External link is fetched.
   */
  private async findScreensMissingTheirImage(screens: Screen[]): Promise<MissingImageFinding[]> {
    const candidates = screens
      .filter(screen => screen.type === 'file' || (screen.type === 'external' && !screen.externalLink))
      .sort((a, b) => a.device.name.localeCompare(b.device.name) || a.order - b.order)
    const findings: MissingImageFinding[] = []

    for (const screen of candidates) {
      if (await fileExists(resolveAppPath('public', 'screens', DEVICES_FOLDER, screen.device.id, `${screen.id}.png`)))
        continue
      findings.push({
        id: findingId('missingImage', screen.id),
        group: 'missingImage',
        screen: {
          id: screen.id,
          name: screen.filename ?? '',
          kind: screen.type,
          deviceId: screen.device.id,
          deviceName: screen.device.name,
          order: screen.order,
        },
      })
    }

    return findings
  }

  /**
   * Fallback Screens cached for an older template version, or for a Device
   * Model and Palette pair no Device currently resolves to (the same
   * resolution the Device poll uses).
   */
  private async findOldFallbackRenders(devices: Device[]): Promise<StoredFileFinding[]> {
    const files = await this.listFiles(resolveAppPath('public', 'screens', FALLBACK_FOLDER), FALLBACK_FOLDER, true)
    const currentPrefix = `${FALLBACK_FOLDER}/v${FALLBACK_SCREEN_TEMPLATE_VERSION}/`
    const inUse = new Set(await Promise.all(devices.map(async (device) => {
      const target = await this.deviceModelsService.renderTargetFor(device)
      return `${target.model.name}-${target.palette.id}`
    })))

    return files
      .filter((file) => {
        if (!file.path.startsWith(currentPrefix))
          return true
        const pair = file.path.slice(currentPrefix.length).split('/')[0]
        return pair === undefined || !inUse.has(pair)
      })
      .map(file => toFileFinding('oldFallbackRender', file))
  }

  private async listDeviceFolders(): Promise<DeviceFolder[]> {
    const root = resolveAppPath('public', 'screens', DEVICES_FOLDER)
    const entries = await fs.promises.readdir(root, { withFileTypes: true }).catch(() => [])
    return Promise.all(entries.filter(entry => entry.isDirectory()).map(async (entry) => {
      const folderPath = `${DEVICES_FOLDER}/${entry.name}`
      const files = await this.listFiles(path.join(root, entry.name), folderPath, true)
      return { deviceId: entry.name, path: folderPath, files, ownFiles: files.filter(file => file.path === `${folderPath}/${file.name}`) }
    }))
  }

  /** The files of a folder, and with `deep` those of the folders in it; a folder that does not exist holds none. */
  private async listFiles(folder: string, folderPath: string, deep = false): Promise<StoredFile[]> {
    const entries = await fs.promises.readdir(folder, { withFileTypes: true }).catch(() => [])
    const files = await Promise.all(entries.map(async (entry): Promise<StoredFile[]> => {
      const entryPath = `${folderPath}/${entry.name}`
      if (entry.isDirectory())
        return deep ? this.listFiles(path.join(folder, entry.name), entryPath, true) : []
      // A render's temporary file can go between listing the folder and reading its size.
      const stat = await fs.promises.stat(path.join(folder, entry.name)).catch(() => undefined)
      return stat ? [{ name: entry.name, path: entryPath, bytes: stat.size, modifiedAtMs: stat.mtimeMs }] : []
    }))
    return files.flat()
  }
}
