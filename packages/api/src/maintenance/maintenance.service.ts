import * as fs from 'node:fs'
import * as path from 'node:path'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Device } from '../devices/devices.entity'
import { Screen } from '../screens/screens.entity'
import { resolveAppPath } from '../utils/pathHelper'

export interface OrphanedScreenFile {
  deviceId: string
  screenId: string
  path: string
  size: number
}

export interface OrphanedDeviceDir {
  deviceId: string
  path: string
  fileCount: number
  size: number
}

export interface BrokenScreen {
  screenId: string
  deviceId: string
  filename: string
  type: string
}

export interface TempFile {
  path: string
  age: number
  size: number
}

export interface MaintenanceIssues {
  orphanedScreenFiles: OrphanedScreenFile[]
  orphanedDeviceDirs: OrphanedDeviceDir[]
  brokenScreens: BrokenScreen[]
  tempFiles: TempFile[]
  oldUploads: TempFile[]
  totalSize: number
  scannedAt: string
}

export interface CleanupResult {
  filesDeleted: number
  dirsDeleted: number
  screensDeleted: number
  bytesFreed: number
  errors: string[]
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

    const orphanedScreenFiles: OrphanedScreenFile[] = []
    const orphanedDeviceDirs: OrphanedDeviceDir[] = []
    const brokenScreens: BrokenScreen[] = []
    const tempFiles: TempFile[] = []
    const oldUploads: TempFile[] = []

    const devices = await this.deviceRepository.find()
    const screens = await this.screenRepository.find({ relations: ['device'] })

    const devicesPath = resolveAppPath('public', 'screens', 'devices')

    if (await this.directoryExists(devicesPath)) {
      const deviceDirs = await fs.promises.readdir(devicesPath)

      for (const deviceDir of deviceDirs) {
        const devicePath = path.join(devicesPath, deviceDir)
        const stat = await fs.promises.stat(devicePath)

        if (!stat.isDirectory())
          continue

        const device = devices.find(d => d.id === deviceDir)

        if (!device) {
          const { fileCount, size } = await this.getDirectoryStats(devicePath)
          orphanedDeviceDirs.push({
            deviceId: deviceDir,
            path: devicePath,
            fileCount,
            size,
          })
          continue
        }

        const files = await fs.promises.readdir(devicePath)

        for (const file of files) {
          const filePath = path.join(devicePath, file)
          const fileStat = await fs.promises.stat(filePath)

          if (fileStat.isDirectory())
            continue

          if (file === 'mirror.png')
            continue

          if (this.isTempFile(file)) {
            const ageHours = (Date.now() - fileStat.mtimeMs) / (1000 * 60 * 60)
            if (ageHours > TEMP_FILE_THRESHOLD_HOURS) {
              tempFiles.push({
                path: filePath,
                age: ageHours,
                size: fileStat.size,
              })
            }
            continue
          }

          const screenId = file.replace('.png', '')
          const screen = screens.find(s => s.id === screenId && s.device.id === deviceDir)

          if (!screen && file.endsWith('.png')) {
            orphanedScreenFiles.push({
              deviceId: deviceDir,
              screenId,
              path: filePath,
              size: fileStat.size,
            })
          }
        }
      }
    }

    for (const screen of screens) {
      const expectedPath = resolveAppPath('public', 'screens', 'devices', screen.device.id, `${screen.id}.png`)

      if (screen.type !== 'plugin' && screen.type !== 'mashup' && !screen.externalLink && !(await this.fileExists(expectedPath))) {
        brokenScreens.push({
          screenId: screen.id,
          deviceId: screen.device.id,
          filename: screen.filename || 'unknown',
          type: screen.type,
        })
      }
    }

    const uploadsPath = resolveAppPath('uploads')
    if (await this.directoryExists(uploadsPath)) {
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
    }

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

    for (const filePath of orphanedFiles) {
      if (!this.isPathSafe(filePath)) {
        result.errors.push(`Unsafe path: ${filePath}`)
        continue
      }

      const filename = path.basename(filePath)
      if (SYSTEM_FILES.has(filename)) {
        result.errors.push(`Protected system file: ${filename}`)
        continue
      }

      try {
        const stat = await fs.promises.stat(filePath)
        if (!dryRun) {
          await fs.promises.unlink(filePath)
          this.logger.log(`Deleted orphaned file: ${filePath}`)
        }
        result.filesDeleted++
        result.bytesFreed += stat.size
      }
      catch (err) {
        result.errors.push(`Failed to delete ${filePath}: ${err.message}`)
      }
    }

    for (const filePath of [...tempFiles, ...oldUploads]) {
      if (!this.isPathSafe(filePath)) {
        result.errors.push(`Unsafe path: ${filePath}`)
        continue
      }

      try {
        const stat = await fs.promises.stat(filePath)
        if (!dryRun) {
          await fs.promises.unlink(filePath)
          this.logger.log(`Deleted temp file: ${filePath}`)
        }
        result.filesDeleted++
        result.bytesFreed += stat.size
      }
      catch (err) {
        result.errors.push(`Failed to delete ${filePath}: ${err.message}`)
      }
    }

    for (const dirPath of orphanedDirs) {
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
        result.errors.push(`Failed to delete ${dirPath}: ${err.message}`)
      }
    }

    for (const screenId of brokenScreens) {
      try {
        if (!dryRun) {
          await this.screenRepository.delete(screenId)
          this.logger.log(`Deleted broken screen: ${screenId}`)
        }
        result.screensDeleted++
      }
      catch (err) {
        result.errors.push(`Failed to delete screen ${screenId}: ${err.message}`)
      }
    }

    this.logger.log(`Cleanup complete. Deleted ${result.filesDeleted} files, ${result.dirsDeleted} dirs, ${result.screensDeleted} screens. Freed ${result.bytesFreed} bytes`)

    return result
  }

  async getStats(): Promise<{ fileCount: number, totalSize: number }> {
    const devicesPath = resolveAppPath('public', 'screens', 'devices')

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
