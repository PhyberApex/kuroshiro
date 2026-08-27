import type { BrokenScreen, CleanupResult, MaintenanceIssues, OrphanedDeviceDir, OrphanedScreenFile, TempFile } from 'kuroshiro-shared'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Device } from '../devices/devices.entity'
import { Screen } from '../screens/screens.entity'
import { getErrorMessage } from '../utils/getErrorMessage'
import { resolveAppPath } from '../utils/pathHelper'

interface DeviceDirEntry {
  deviceId: string
  devicePath: string
}

const SYSTEM_FILES = new Set([
  'noScreen.png',
  'error.png',
  'welcome.png',
  'colormap-2bit.png',
])

const TEMP_FILE_THRESHOLD_HOURS = 24

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name)

  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    @InjectRepository(Screen)
    private screenRepository: Repository<Screen>,
  ) {}

  async scan(): Promise<MaintenanceIssues> {
    this.logger.log('Starting maintenance scan')

    const devices = await this.deviceRepository.find()
    const screens = await this.screenRepository.find({ relations: { device: true } })
    const { known: deviceDirs, orphaned: orphanedDirEntries } = await this.listDevicesPathEntries(devices)

    const orphanedScreenFiles = await this.findOrphanedScreenFiles(deviceDirs, screens)
    const orphanedDeviceDirs = await this.findOrphanedDeviceDirs(orphanedDirEntries)
    const brokenScreens = await this.findBrokenScreens(screens)
    const tempFiles = await this.findTempFiles(deviceDirs)
    const oldUploads = await this.findOldUploads()

    const totalSize = [
      ...orphanedScreenFiles.map(f => f.size),
      ...orphanedDeviceDirs.map(d => d.size),
      ...tempFiles.map(f => f.size),
      ...oldUploads.map(f => f.size),
    ].reduce((sum, size) => sum + size, 0)

    this.logger.log(`Scan complete. Found ${orphanedScreenFiles.length} orphaned files, ${orphanedDeviceDirs.length} orphaned dirs, ${brokenScreens.length} broken screens`)

    return {
      orphanedScreenFiles,
      orphanedDeviceDirs,
      brokenScreens,
      tempFiles,
      oldUploads,
      totalSize,
      scannedAt: new Date().toISOString(),
    }
  }

  /** The path under which each device's screen directory lives. */
  private devicesRootPath(): string {
    return resolveAppPath('public', 'screens', 'devices')
  }

  /** A single pass over `devicesRootPath()`, split into directories that match a known device and those that don't. */
  private async listDevicesPathEntries(devices: Device[]): Promise<{ known: DeviceDirEntry[], orphaned: DeviceDirEntry[] }> {
    const known: DeviceDirEntry[] = []
    const orphaned: DeviceDirEntry[] = []

    const devicesPath = this.devicesRootPath()
    if (!(await this.directoryExists(devicesPath)))
      return { known, orphaned }

    const entries = await fs.promises.readdir(devicesPath)

    for (const entry of entries) {
      const devicePath = path.join(devicesPath, entry)
      const stat = await fs.promises.stat(devicePath)

      if (!stat.isDirectory())
        continue

      const dir: DeviceDirEntry = { deviceId: entry, devicePath }
      if (devices.some(d => d.id === entry))
        known.push(dir)
      else
        orphaned.push(dir)
    }

    return { known, orphaned }
  }

  private async findOrphanedScreenFiles(deviceDirs: DeviceDirEntry[], screens: Screen[]): Promise<OrphanedScreenFile[]> {
    const orphanedScreenFiles: OrphanedScreenFile[] = []

    for (const { deviceId, devicePath } of deviceDirs) {
      const files = await fs.promises.readdir(devicePath)

      for (const file of files) {
        const filePath = path.join(devicePath, file)
        const fileStat = await fs.promises.stat(filePath)

        if (fileStat.isDirectory() || file === 'mirror.png' || this.isTempFile(file))
          continue

        const screenId = file.replace(/\.(png|original)$/, '')
        const screen = screens.find(s => s.id === screenId && s.device.id === deviceId)

        if (!screen && (file.endsWith('.png') || file.endsWith('.original'))) {
          orphanedScreenFiles.push({
            deviceId,
            screenId,
            path: filePath,
            size: fileStat.size,
          })
        }
      }
    }

    return orphanedScreenFiles
  }

  private async findOrphanedDeviceDirs(orphanedDirEntries: DeviceDirEntry[]): Promise<OrphanedDeviceDir[]> {
    const orphanedDeviceDirs: OrphanedDeviceDir[] = []

    for (const { deviceId, devicePath } of orphanedDirEntries) {
      const { fileCount, size } = await this.getDirectoryStats(devicePath)
      orphanedDeviceDirs.push({
        deviceId,
        path: devicePath,
        fileCount,
        size,
      })
    }

    return orphanedDeviceDirs
  }

  private async findTempFiles(deviceDirs: DeviceDirEntry[]): Promise<TempFile[]> {
    const tempFiles: TempFile[] = []

    for (const { devicePath } of deviceDirs) {
      const files = await fs.promises.readdir(devicePath)

      for (const file of files) {
        if (!this.isTempFile(file))
          continue

        const filePath = path.join(devicePath, file)
        const fileStat = await fs.promises.stat(filePath)

        if (fileStat.isDirectory())
          continue

        const ageHours = (Date.now() - fileStat.mtimeMs) / (1000 * 60 * 60)
        if (ageHours > TEMP_FILE_THRESHOLD_HOURS) {
          tempFiles.push({
            path: filePath,
            age: ageHours,
            size: fileStat.size,
          })
        }
      }
    }

    return tempFiles
  }

  private async findBrokenScreens(screens: Screen[]): Promise<BrokenScreen[]> {
    const brokenScreens: BrokenScreen[] = []

    for (const screen of screens) {
      const expectedPath = path.join(this.devicesRootPath(), screen.device.id, `${screen.id}.png`)

      if (screen.type !== 'plugin' && screen.type !== 'mashup' && !screen.externalLink && !(await this.fileExists(expectedPath))) {
        brokenScreens.push({
          screenId: screen.id,
          deviceId: screen.device.id,
          filename: screen.filename || 'unknown',
          type: screen.type,
        })
      }
    }

    return brokenScreens
  }

  private async findOldUploads(): Promise<TempFile[]> {
    const oldUploads: TempFile[] = []

    const uploadsPath = resolveAppPath('uploads')
    if (!(await this.directoryExists(uploadsPath)))
      return oldUploads

    const uploadFiles = await fs.promises.readdir(uploadsPath)

    for (const file of uploadFiles) {
      const filePath = path.join(uploadsPath, file)
      const stat = await fs.promises.stat(filePath)

      if (stat.isDirectory())
        continue

      const ageHours = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60)
      if (ageHours > TEMP_FILE_THRESHOLD_HOURS) {
        oldUploads.push({
          path: filePath,
          age: ageHours,
          size: stat.size,
        })
      }
    }

    return oldUploads
  }

  async cleanup(
    orphanedFiles: string[],
    orphanedDirs: string[],
    brokenScreens: string[],
    tempFiles: string[],
    oldUploads: string[],
    dryRun: boolean = false,
  ): Promise<CleanupResult> {
    this.logger.log(`Starting cleanup (dryRun: ${dryRun})`)

    const result: CleanupResult = {
      filesDeleted: 0,
      dirsDeleted: 0,
      screensDeleted: 0,
      bytesFreed: 0,
      errors: [],
    }

    await this.deleteFiles(orphanedFiles, result, dryRun, { protectSystemFiles: true, logLabel: 'orphaned file' })
    await this.deleteFiles([...tempFiles, ...oldUploads], result, dryRun, { protectSystemFiles: false, logLabel: 'temp file' })
    await this.deleteDirs(orphanedDirs, result, dryRun)

    for (const screenId of brokenScreens) {
      try {
        if (!dryRun) {
          await this.screenRepository.delete(screenId)
          this.logger.log(`Deleted broken screen: ${screenId}`)
        }
        result.screensDeleted++
      }
      catch (err) {
        const message = getErrorMessage(err)
        result.errors.push(`Failed to delete screen ${screenId}: ${message}`)
      }
    }

    this.logger.log(`Cleanup complete. Deleted ${result.filesDeleted} files, ${result.dirsDeleted} dirs, ${result.screensDeleted} screens. Freed ${result.bytesFreed} bytes`)

    return result
  }

  private async deleteFiles(
    paths: string[],
    result: CleanupResult,
    dryRun: boolean,
    options: { protectSystemFiles: boolean, logLabel: string },
  ): Promise<void> {
    for (const filePath of paths) {
      if (!this.isPathSafe(filePath)) {
        result.errors.push(`Unsafe path: ${filePath}`)
        continue
      }

      if (options.protectSystemFiles) {
        const filename = path.basename(filePath)
        if (SYSTEM_FILES.has(filename)) {
          result.errors.push(`Protected system file: ${filename}`)
          continue
        }
      }

      try {
        const stat = await fs.promises.stat(filePath)
        if (!dryRun) {
          await fs.promises.unlink(filePath)
          this.logger.log(`Deleted ${options.logLabel}: ${filePath}`)
        }
        result.filesDeleted++
        result.bytesFreed += stat.size
      }
      catch (err) {
        const message = getErrorMessage(err)
        result.errors.push(`Failed to delete ${filePath}: ${message}`)
      }
    }
  }

  private async deleteDirs(paths: string[], result: CleanupResult, dryRun: boolean): Promise<void> {
    for (const dirPath of paths) {
      if (!this.isPathSafe(dirPath)) {
        result.errors.push(`Unsafe path: ${dirPath}`)
        continue
      }

      try {
        const { size } = await this.getDirectoryStats(dirPath)
        if (!dryRun) {
          await fs.promises.rm(dirPath, { recursive: true, force: true })
          this.logger.log(`Deleted orphaned directory: ${dirPath}`)
        }
        result.dirsDeleted++
        result.bytesFreed += size
      }
      catch (err) {
        const message = getErrorMessage(err)
        result.errors.push(`Failed to delete ${dirPath}: ${message}`)
      }
    }
  }

  async getStats(): Promise<{ fileCount: number, totalSize: number }> {
    const devicesPath = this.devicesRootPath()

    if (!(await this.directoryExists(devicesPath))) {
      return { fileCount: 0, totalSize: 0 }
    }

    const { fileCount, size } = await this.getDirectoryStats(devicesPath)

    return { fileCount, totalSize: size }
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.promises.access(path, fs.constants.F_OK)
      return true
    }
    catch {
      return false
    }
  }

  private async directoryExists(path: string): Promise<boolean> {
    try {
      const stat = await fs.promises.stat(path)
      return stat.isDirectory()
    }
    catch {
      return false
    }
  }

  private async getDirectoryStats(dirPath: string): Promise<{ fileCount: number, size: number }> {
    let fileCount = 0
    let size = 0

    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)

      if (entry.isDirectory()) {
        const subStats = await this.getDirectoryStats(fullPath)
        fileCount += subStats.fileCount
        size += subStats.size
      }
      else {
        const stat = await fs.promises.stat(fullPath)
        fileCount++
        size += stat.size
      }
    }

    return { fileCount, size }
  }

  private isTempFile(filename: string): boolean {
    return filename === 'tmp-source'
      || filename.endsWith('-source')
      || filename.startsWith('tmp-')
  }

  private isPathSafe(filePath: string): boolean {
    const normalized = path.normalize(filePath)
    return !normalized.includes('..')
      && (normalized.includes('public/screens/devices') || normalized.includes('uploads'))
  }
}
